const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Test</title>
</head>
<body>
    <div id="loginContainer" class="login-wrapper hidden">
        <form id="loginForm" class="login-card">
            <div class="login-group">
                <label for="loginUsuario">Usuario</label>
                <input type="text" id="loginUsuario" autocomplete="username" required>
            </div>
            <p id="loginError" class="login-error" role="alert"></p>
            <button type="submit">Ingresar</button>
        </form>
    </div>
    <div class="container hidden"></div>
</body>
</html>`;

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

window.Chart = function() {
    return {
        destroy() {},
        update() {}
    };
};

function crearClienteSupabaseMock() {
    return {
        from() {
            return {
                select() {
                    return {
                        ilike(_columna, valor) {
                            return {
                                limit() {
                                    const coincide = valor.trim().toLowerCase() === 'admin';
                                    return Promise.resolve({
                                        data: coincide ? [{ id: 1, username: 'admin' }] : [],
                                        error: null
                                    });
                                }
                            };
                        }
                    };
                }
            };
        }
    };
}

const supabaseMock = {
    createClient: () => crearClienteSupabaseMock()
};

window.supabase = supabaseMock;
global.supabase = supabaseMock;

const scriptContent = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
const vm = require('vm');
const script = new vm.Script(scriptContent);
script.runInContext(dom.getInternalVMContext());

let inicializada = false;
window.inicializarAplicacion = () => {
    inicializada = true;
};

async function main() {
    window.dispatchEvent(new window.Event('DOMContentLoaded'));

    const loginContainer = window.document.getElementById('loginContainer');
    const mainContainer = window.document.querySelector('.container');
    const loginForm = window.document.getElementById('loginForm');
    const loginUsuario = window.document.getElementById('loginUsuario');
    const loginError = window.document.getElementById('loginError');
    const submitButton = loginForm.querySelector('button[type="submit"]');

    assert(loginContainer && !loginContainer.classList.contains('hidden'), 'El formulario debe mostrarse tras iniciar.');
    assert(mainContainer && mainContainer.classList.contains('hidden'), 'El dashboard debe permanecer oculto inicialmente.');

    loginUsuario.value = 'usuario';
    loginForm.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 5));

    assert.strictEqual(window.sessionStorage.getItem('usuarioAutenticado'), null, 'No debe guardarse sesión con usuario inválido.');
    assert(loginError.textContent.includes('Usuario no autorizado'), 'Debe mostrar error de usuario inválido.');
    assert(!submitButton.disabled, 'El botón debe reactivarse tras fallo.');
    assert(mainContainer.classList.contains('hidden'), 'El dashboard debe seguir oculto tras fallo.');

    loginUsuario.value = 'admin';
    loginForm.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 5));

    assert(window.sessionStorage.getItem('usuarioAutenticado') === 'true', 'Debe guardarse la sesión tras login correcto.');
    assert.strictEqual(window.sessionStorage.getItem('usuarioNombre'), 'admin', 'Debe persistir el nombre de usuario.');
    assert.strictEqual(window.sessionStorage.getItem('usuarioId'), '1', 'Debe guardar el id del usuario.');
    assert(loginContainer.classList.contains('hidden'), 'El formulario debe ocultarse tras login correcto.');
    assert(!mainContainer.classList.contains('hidden'), 'El dashboard debe mostrarse tras login correcto.');
    assert(inicializada, 'Debe inicializar la aplicación tras login correcto.');
}

main().then(() => {
    console.log('Login tests passed');
}).catch(error => {
    console.error(error);
    process.exit(1);
});
