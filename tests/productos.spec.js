const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const vm = require('vm');
const { attachSupabase, resetSupabaseState, productosMock } = require('./helpers/supabaseMock');

let html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
html = html
    .replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/[^>]+><\/script>/g, '')
    .replace(/<script src="app\.js"><\/script>/, '');

const dom = new JSDOM(html, {
    url: 'http://localhost',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
});

const { window } = dom;

Object.assign(global, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    navigator: window.navigator,
    alert: () => {},
    confirm: () => true
});

window.alert = () => {};
window.confirm = () => true;
global.alert = window.alert;
global.confirm = window.confirm;

if (window.HTMLCanvasElement) {
    window.HTMLCanvasElement.prototype.getContext = () => ({
        fillRect() {},
        clearRect() {},
        getImageData() { return { data: [] }; },
        putImageData() {},
        createImageData() { return []; },
        setTransform() {},
        drawImage() {},
        save() {},
        fillText() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        stroke() {},
        translate() {},
        scale() {},
        rotate() {},
        arc() {},
        fill() {},
        measureText() { return { width: 0 }; },
        transform() {},
        rect() {},
        clip() {}
    });
}

attachSupabase(window);
resetSupabaseState();

window.Chart = function() {
    return {
        destroy() {},
        update() {}
    };
};

window.Chart.defaults = { font: {} };

global.Chart = window.Chart;

const scriptContent = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
const script = new vm.Script(scriptContent);
script.runInContext(dom.getInternalVMContext());

testProductos().catch(error => {
    console.error(error);
    process.exit(1);
});

async function testProductos() {
    window.dispatchEvent(new window.Event('DOMContentLoaded'));

    const loginForm = document.getElementById('loginForm');
    const loginUsuario = document.getElementById('loginUsuario');

    loginUsuario.value = 'admin';
    loginForm.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));

    const mainContainer = document.querySelector('.container');
    assert(!mainContainer.classList.contains('hidden'), 'El dashboard debe mostrarse tras login.');

    const nombreInput = document.getElementById('prod-nombre');
    const tipoSelect = document.getElementById('prod-tipo');
    const monedaSelect = document.getElementById('prod-moneda');
    const costoInput = document.getElementById('prod-costo');
    const precioInput = document.getElementById('prod-precio');
    const unidadesInput = document.getElementById('prod-unidades');
    const submitButton = document.getElementById('prod-submit');
    const cancelButton = document.getElementById('prod-cancel');
    const listaProductos = document.getElementById('lista-productos');

    assert(cancelButton.classList.contains('hidden'), 'El botón de cancelar debe estar oculto inicialmente.');

    nombreInput.value = 'Café Gourmet';
    tipoSelect.value = 'producto';
    monedaSelect.value = 'CRC';
    costoInput.value = '1500';
    precioInput.value = '3500';
    unidadesInput.value = '10';

    await window.agregarProducto();

    assert.strictEqual(productosMock.length, 1, 'Debe crear el producto en Supabase.');
    assert(listaProductos.textContent.includes('Café Gourmet'), 'Debe renderizar el producto creado.');
    assert.strictEqual(submitButton.textContent.trim(), '➕ Agregar Producto', 'El botón debe permanecer en modo agregar tras crear.');

    const productoId = productosMock[0].id;
    const editButton = listaProductos.querySelector('.edit-btn');
    assert(editButton, 'Debe existir un botón de edición.');

    editButton.click();

    assert.strictEqual(submitButton.textContent.trim(), '💾 Guardar Cambios', 'El botón debe indicar modo edición.');
    assert(!cancelButton.classList.contains('hidden'), 'Debe mostrarse el botón de cancelar durante la edición.');
    assert.strictEqual(nombreInput.value, 'Café Gourmet', 'Debe rellenar el formulario con el nombre del producto.');

    nombreInput.value = 'Café Especial';
    precioInput.value = '4000';
    unidadesInput.value = '15';

    await window.agregarProducto();

    assert.strictEqual(productosMock[0].nombre, 'Café Especial', 'Debe actualizar el registro en Supabase.');
    assert(listaProductos.textContent.includes('Café Especial'), 'Debe reflejar el nombre actualizado en la lista.');
    assert.strictEqual(submitButton.textContent.trim(), '➕ Agregar Producto', 'El botón debe volver al modo agregar tras guardar.');
    assert(cancelButton.classList.contains('hidden'), 'El botón de cancelar debe ocultarse tras guardar.');

    await window.eliminarProducto(productoId);

    assert.strictEqual(productosMock.length, 0, 'Debe eliminar el producto en Supabase.');
    assert(listaProductos.textContent.includes('No hay productos registrados'), 'Debe mostrar el estado vacío tras eliminar.');

    console.log('Product CRUD tests passed');
}
