// Credenciales Supabase
const SUPABASE_URL = 'https://jsjwgjaprgymeonsadny.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzandnamFwcmd5bWVvbnNhZG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzY5NjQsImV4cCI6MjA3NDIxMjk2NH0.4fjXkdOCyaubZuVIZNeViaA6MfdDK-4pdH9h-Ty2bfk';

let supabaseClient = null;

function obtenerClienteSupabase() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

async function buscarUsuarioEnSupabase(username, password) {
    const cliente = obtenerClienteSupabase();
    if (!cliente) {
        throw new Error('Supabase no está disponible');
    }

    const patron = username.replace(/[\%_]/g, '\\$&');
    const { data, error } = await cliente
        .from('usuarios')
        .select('id, username, password')
        .ilike('username', patron)
        .limit(1);

    if (error) {
        throw error;
    }

    const usuario = Array.isArray(data) ? data[0] : null;

    if (!usuario) {
        return null;
    }

    if (typeof usuario.password !== 'string') {
        return null;
    }

    if (usuario.password !== password) {
        return null;
    }

    return { id: usuario.id, username: usuario.username };
}

function mapearProductoDeSupabase(fila) {
    if (!fila) return null;
    const parseNumero = (valor) => {
        if (valor === null || valor === undefined || valor === '') return 0;
        const numero = typeof valor === 'number' ? valor : parseFloat(valor);
        return Number.isNaN(numero) ? 0 : numero;
    };

    return {
        id: fila.id,
        nombre: fila.nombre,
        tipo: fila.tipo,
        moneda: fila.moneda,
        costoUnitario: parseNumero(fila.costo_unitario ?? fila.costoUnitario),
        precioVenta: parseNumero(fila.precio_venta ?? fila.precioVenta),
        unidadesVendidas: parseNumero(fila.unidades_vendidas ?? fila.unidadesVendidas)
    };
}

function mapearCostoFijoDeSupabase(fila) {
    if (!fila) return null;

    const parseNumero = (valor) => {
        if (valor === null || valor === undefined || valor === '') return 0;
        const numero = typeof valor === 'number' ? valor : parseFloat(valor);
        return Number.isNaN(numero) ? 0 : numero;
    };

    return {
        id: fila.id,
        concepto: fila.concepto,
        moneda: fila.moneda,
        monto: parseNumero(fila.monto),
        frecuencia: fila.frecuencia
    };
}

function mapearTransaccionDeSupabase(fila) {
    if (!fila) return null;

    const parseNumero = (valor) => {
        if (valor === null || valor === undefined || valor === '') return 0;
        const numero = typeof valor === 'number' ? valor : parseFloat(valor);
        return Number.isNaN(numero) ? 0 : numero;
    };

    return {
        id: fila.id,
        fecha: fila.fecha,
        tipo: fila.tipo,
        categoria: fila.categoria,
        concepto: fila.concepto,
        moneda: fila.moneda,
        monto: parseNumero(fila.monto)
    };
}

async function sincronizarProductosDesdeSupabase() {
    if (!usuarioActual || !usuarioActual.id) return;

    const cliente = obtenerClienteSupabase();
    if (!cliente) return;

    try {
        const { data, error } = await cliente
            .from('productos')
            .select('id, nombre, tipo, moneda, costo_unitario, precio_venta, unidades_vendidas')
            .eq('usuario_id', usuarioActual.id)
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        if (Array.isArray(data)) {
            const productosRemotos = data
                .map(mapearProductoDeSupabase)
                .filter(Boolean);
            const productosLocales = Array.isArray(state.productos) ? state.productos : [];
            const idsRemotos = new Set(productosRemotos.map(p => p.id));
            const productosNoSincronizados = productosLocales.filter(p => !idsRemotos.has(p.id));

            state.productos = [...productosRemotos, ...productosNoSincronizados];
            actualizarVistas();
            guardarDatos();
        }
    } catch (error) {
        console.error('Error al cargar productos desde Supabase:', error);
    }
}

async function sincronizarCostosFijosDesdeSupabase() {
    if (!usuarioActual || !usuarioActual.id) return;

    const cliente = obtenerClienteSupabase();
    if (!cliente) return;

    try {
        const { data, error } = await cliente
            .from('costos_fijos')
            .select('id, concepto, moneda, monto, frecuencia, created_at')
            .eq('usuario_id', usuarioActual.id)
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        if (Array.isArray(data)) {
            const costosRemotos = data
                .map(mapearCostoFijoDeSupabase)
                .filter(Boolean);
            const costosLocales = Array.isArray(state.costosFijos) ? state.costosFijos : [];
            const idsRemotos = new Set(costosRemotos.map(c => c.id));
            const costosNoSincronizados = costosLocales.filter(c => !idsRemotos.has(c.id));

            state.costosFijos = [...costosRemotos, ...costosNoSincronizados];
            actualizarVistas();
            guardarDatos();
        }
    } catch (error) {
        console.error('Error al cargar costos fijos desde Supabase:', error);
    }
}

async function sincronizarFlujoCajaDesdeSupabase() {
    if (!usuarioActual || !usuarioActual.id) return;

    const cliente = obtenerClienteSupabase();
    if (!cliente) return;

    try {
        const { data, error } = await cliente
            .from('flujo_caja')
            .select('id, fecha, tipo, categoria, concepto, moneda, monto, created_at')
            .eq('usuario_id', usuarioActual.id)
            .order('fecha', { ascending: false });

        if (error) {
            throw error;
        }

        if (Array.isArray(data)) {
            const transaccionesRemotas = data
                .map(mapearTransaccionDeSupabase)
                .filter(Boolean)
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || (a.id - b.id));
            const transaccionesLocales = Array.isArray(state.transacciones) ? state.transacciones : [];
            const idsRemotos = new Set(transaccionesRemotas.map(t => t.id));
            const transaccionesNoSincronizadas = transaccionesLocales.filter(t => !idsRemotos.has(t.id));

            state.transacciones = [...transaccionesRemotas, ...transaccionesNoSincronizadas];
            actualizarVistas();
            guardarDatos();
        }
    } catch (error) {
        console.error('Error al cargar flujo de caja desde Supabase:', error);
    }
}

// Estado Global
function crearEstadoInicial() {
    return {
        productos: [],
        costosFijos: [],
        transacciones: [],
        moneda: 'CRC',
        tasaCambio: 520
    };
}

let state = crearEstadoInicial();

let usuarioActual = null;

let productoEditandoId = null;
let productoEditandoOriginal = null;
let productoConfirmandoEliminarId = null;
let costoFijoEditandoId = null;
let costoFijoEditandoOriginal = null;
let costoFijoConfirmandoEliminarId = null;
let transaccionEditandoId = null;
let transaccionEditandoOriginal = null;
let transaccionConfirmandoEliminarId = null;

function manejarCambioMes() {
    const mesSelector = document.getElementById('mes-seleccionado');
    if (mesSelector) {
        mesSelector.dataset.usuarioSeleccion = 'true';
    }
    actualizarFlujoCaja();
}

// Configuración de monedas
const monedas = {
    CRC: { simbolo: '₡', nombre: 'Colones', decimales: 0 },
    USD: { simbolo: '$', nombre: 'Dólares', decimales: 2 }
};

function obtenerClaveAlmacenamiento(usuario = usuarioActual) {
    if (usuario && usuario.id !== undefined && usuario.id !== null && usuario.id !== '') {
        return `sistemaFinanciero:${usuario.id}`;
    }
    return 'sistemaFinanciero';
}

// Charts globales
let flujoChart, margenChart, equilibrioChart;
let appInicializada = false;

// Inicialización
window.addEventListener('DOMContentLoaded', function() {
    configurarAutenticacion();
});

function inicializarAplicacion() {
    if (appInicializada) return;

    const fechaTransaccion = document.getElementById('trans-fecha');
    const mesSeleccionado = document.getElementById('mes-seleccionado');

    if (fechaTransaccion) {
        fechaTransaccion.value = new Date().toISOString().split('T')[0];
    }

    if (mesSeleccionado) {
        mesSeleccionado.value = new Date().toISOString().slice(0, 7);
        mesSeleccionado.dataset.usuarioSeleccion = 'false';
    }

    cargarDatos();
    inicializarGraficos();
    actualizarVistas();

    appInicializada = true;
}

function configurarAutenticacion() {
    const loginContainer = document.getElementById('loginContainer');
    const mainContainer = document.querySelector('.container');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginUsuario = document.getElementById('loginUsuario');
    const loginPassword = document.getElementById('loginPassword');
    const loginSubmit = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
    const logoutButton = document.getElementById('logoutButton');

    if (!loginContainer || !mainContainer || !loginForm) {
        inicializarAplicacion();
        return;
    }

    const mostrarFormularioLogin = () => {
        loginContainer.classList.remove('hidden');
        mainContainer.classList.add('hidden');
        if (loginForm) {
            loginForm.reset();
        }
        if (loginError) {
            loginError.textContent = '';
        }
        if (loginUsuario) {
            setTimeout(() => loginUsuario.focus(), 50);
        }
    };

    const manejarSesionActiva = (usuario) => {
        if (!usuario) return;
        usuarioActual = usuario;
        sessionStorage.setItem('usuarioAutenticado', 'true');
        if (usuario.id) {
            sessionStorage.setItem('usuarioId', String(usuario.id));
        }
        if (usuario.username) {
            sessionStorage.setItem('usuarioNombre', usuario.username);
        }
        state = crearEstadoInicial();
        cancelarEdicionProducto();
        cancelarEdicionCostoFijo();
        cancelarEdicionTransaccion();
        cargarDatos();
        actualizarVistas();
        if (loginError) {
            loginError.textContent = '';
        }
        loginContainer.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        if (loginForm) {
            loginForm.reset();
        }
        inicializarAplicacion();
        sincronizarProductosDesdeSupabase();
        sincronizarCostosFijosDesdeSupabase();
        sincronizarFlujoCajaDesdeSupabase();
    };

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            ['usuarioAutenticado', 'usuarioId', 'usuarioNombre'].forEach((clave) => {
                sessionStorage.removeItem(clave);
            });
            if (flujoChart && typeof flujoChart.destroy === 'function') {
                flujoChart.destroy();
            }
            if (margenChart && typeof margenChart.destroy === 'function') {
                margenChart.destroy();
            }
            if (equilibrioChart && typeof equilibrioChart.destroy === 'function') {
                equilibrioChart.destroy();
            }
            flujoChart = null;
            margenChart = null;
            equilibrioChart = null;
            appInicializada = false;
            state = crearEstadoInicial();
            const selectorMoneda = document.getElementById('selectMoneda');
            if (selectorMoneda) {
                selectorMoneda.value = state.moneda;
            }
            const etiquetaMoneda = document.getElementById('monedaActual');
            if (etiquetaMoneda) {
                etiquetaMoneda.textContent = `${monedas[state.moneda].simbolo} ${state.moneda}`;
            }
            const tasaCambioInput = document.getElementById('tasaCambio');
            if (tasaCambioInput) {
                tasaCambioInput.value = state.tasaCambio;
            }
            const mesSelector = document.getElementById('mes-seleccionado');
            if (mesSelector) {
                mesSelector.value = new Date().toISOString().slice(0, 7);
                mesSelector.dataset.usuarioSeleccion = 'false';
            }
            cancelarEdicionProducto();
            cancelarEdicionCostoFijo();
            cancelarEdicionTransaccion();
            actualizarVistas();
            usuarioActual = null;
            mostrarFormularioLogin();
        });
    }

    const sesionPersistida = sessionStorage.getItem('usuarioAutenticado') === 'true';
    if (sesionPersistida) {
        const usernamePersistido = sessionStorage.getItem('usuarioNombre') || 'admin';
        const idPersistido = sessionStorage.getItem('usuarioId');
        manejarSesionActiva({ username: usernamePersistido, id: idPersistido ? parseInt(idPersistido, 10) : undefined });
        return;
    }

    mostrarFormularioLogin();

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const usuario = loginUsuario ? loginUsuario.value.trim() : '';
        const password = loginPassword ? loginPassword.value : '';

        if (loginError) {
            loginError.textContent = '';
        }

        if (!usuario || !password) {
            if (loginError) {
                loginError.textContent = 'Por favor, ingresa tu usuario y contraseña.';
            }
            if (!usuario && loginUsuario) {
                loginUsuario.focus();
            } else if (!password && loginPassword) {
                loginPassword.focus();
            }
            return;
        }

        const botonOriginal = loginSubmit ? loginSubmit.textContent : '';
        if (loginSubmit) {
            loginSubmit.disabled = true;
            loginSubmit.textContent = 'Verificando...';
        }

        try {
            const usuarioEncontrado = await buscarUsuarioEnSupabase(usuario, password);

            if (!usuarioEncontrado) {
                if (loginError) {
                    loginError.textContent = 'Usuario no autorizado. Verifica tus credenciales.';
                }
                if (loginPassword) {
                    loginPassword.value = '';
                }
                if (loginPassword) {
                    loginPassword.focus();
                    if (typeof loginPassword.select === 'function') {
                        loginPassword.select();
                    }
                }
                return;
            }

            manejarSesionActiva({ username: usuarioEncontrado.username, id: usuarioEncontrado.id });
        } catch (error) {
            console.error('Error al verificar usuario en Supabase:', error);
            if (loginError) {
                loginError.textContent = 'No se pudo validar el usuario. Intenta nuevamente en unos minutos.';
            }
        } finally {
            if (loginSubmit) {
                loginSubmit.disabled = false;
                loginSubmit.textContent = botonOriginal || 'Ingresar';
            }
        }
    });
}

// Funciones de UI
function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    dropdown.classList.toggle('show');
    
    // Cerrar otros dropdowns
    document.querySelectorAll('.dropdown-content').forEach(d => {
        if (d.id !== id) d.classList.remove('show');
    });
}

// Cerrar dropdowns al hacer clic fuera
window.onclick = function(event) {
    if (!event.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-content').forEach(d => {
            d.classList.remove('show');
        });
    }
}

function cambiarTab(tab, el) {
    // Actualizar tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if (el) el.classList.add('active');
    const content = document.getElementById(`tab-${tab}`);
    if (content) content.classList.add('active');
    
    // Actualizar gráficos si es necesario
    if (tab === 'analisis') {
        setTimeout(() => {
            actualizarGraficos();
        }, 100);
    }
}

// Funciones de Moneda
function formatearMoneda(valor, monedaEspecifica = state.moneda) {
    const config = monedas[monedaEspecifica];
    return `${config.simbolo}${valor.toLocaleString('es-CR', {
        minimumFractionDigits: config.decimales,
        maximumFractionDigits: config.decimales
    })}`;
}

function convertirMoneda(valor, deMoneda, aMoneda) {
    if (deMoneda === aMoneda) return valor;
    if (deMoneda === 'CRC' && aMoneda === 'USD') return valor / state.tasaCambio;
    if (deMoneda === 'USD' && aMoneda === 'CRC') return valor * state.tasaCambio;
    return valor;
}

function cambiarMoneda() {
    state.moneda = document.getElementById('selectMoneda').value;
    document.getElementById('monedaActual').textContent = `${monedas[state.moneda].simbolo} ${state.moneda}`;
    actualizarVistas();
    guardarDatos();
}

function actualizarTasaCambio() {
    state.tasaCambio = parseFloat(document.getElementById('tasaCambio').value) || 520;
    document.getElementById('tasaDolar').textContent = (1/state.tasaCambio).toFixed(4);
    actualizarVistas();
    guardarDatos();
}

// CRUD Productos
async function agregarProducto() {
    const nombre = document.getElementById('prod-nombre').value;
    const tipo = document.getElementById('prod-tipo').value;
    const moneda = document.getElementById('prod-moneda').value;
    const costo = parseFloat(document.getElementById('prod-costo').value) || 0;
    const precio = parseFloat(document.getElementById('prod-precio').value) || 0;
    const unidades = parseInt(document.getElementById('prod-unidades').value) || 0;

    if (!nombre || costo <= 0 || precio <= 0) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }

    if (productoEditandoId !== null) {
        const indice = state.productos.findIndex(p => p.id === productoEditandoId);
        if (indice === -1) {
            alert('No se encontró el producto que intentas editar.');
            cancelarEdicionProducto();
            return;
        }

        const productoAnterior = productoEditandoOriginal
            ? { ...productoEditandoOriginal }
            : { ...state.productos[indice] };

        let productoActualizado = {
            ...state.productos[indice],
            nombre,
            tipo,
            moneda,
            costoUnitario: costo,
            precioVenta: precio,
            unidadesVendidas: unidades
        };

        state.productos[indice] = productoActualizado;
        actualizarVistas();
        guardarDatos();

        const cliente = obtenerClienteSupabase();
        if (cliente && usuarioActual && usuarioActual.id) {
            try {
                const { data, error } = await cliente
                    .from('productos')
                    .update({
                        nombre,
                        tipo,
                        moneda,
                        costo_unitario: costo,
                        precio_venta: precio,
                        unidades_vendidas: unidades
                    })
                    .eq('id', productoEditandoId)
                    .eq('usuario_id', usuarioActual.id)
                    .select('id, nombre, tipo, moneda, costo_unitario, precio_venta, unidades_vendidas')
                    .single();

                if (error) {
                    throw error;
                }

                const productoSupabase = mapearProductoDeSupabase(data);
                if (productoSupabase) {
                    productoActualizado = productoSupabase;
                    state.productos[indice] = productoSupabase;
                }
            } catch (error) {
                console.error('Error al actualizar producto en Supabase:', error);
                state.productos[indice] = productoAnterior;
                productoEditandoOriginal = { ...productoAnterior };
                actualizarVistas();
                guardarDatos();
                alert('No se pudo actualizar el producto en la base de datos. Intenta nuevamente.');
                return;
            }
        } else if (usuarioActual && usuarioActual.id) {
            alert('No se pudo conectar con la base de datos. Los cambios se guardaron localmente.');
        }

        cancelarEdicionProducto();
        actualizarVistas();
        guardarDatos();
        return;
    }

    let productoParaEstado = {
        id: Date.now(),
        nombre,
        tipo,
        moneda,
        costoUnitario: costo,
        precioVenta: precio,
        unidadesVendidas: unidades
    };

    const cliente = obtenerClienteSupabase();
    if (cliente && usuarioActual && usuarioActual.id) {
        try {
            const { data, error } = await cliente
                .from('productos')
                .insert([
                    {
                        usuario_id: usuarioActual.id,
                        nombre,
                        tipo,
                        moneda,
                        costo_unitario: costo,
                        precio_venta: precio,
                        unidades_vendidas: unidades
                    }
                ])
                .select('id, nombre, tipo, moneda, costo_unitario, precio_venta, unidades_vendidas')
                .single();

            if (error) {
                throw error;
            }

            const productoSupabase = mapearProductoDeSupabase(data);
            if (productoSupabase) {
                productoParaEstado = productoSupabase;
            }
        } catch (error) {
            console.error('Error al guardar producto en Supabase:', error);
            alert('El producto se guardó localmente pero no en la base de datos. Intenta nuevamente cuando tengas conexión.');
        }
    } else if (usuarioActual && usuarioActual.id) {
        alert('No se pudo conectar con la base de datos. El producto se guardará localmente.');
    }

    state.productos.push(productoParaEstado);

    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-costo').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-unidades').value = '';

    actualizarVistas();
    guardarDatos();
}

function prepararEdicionProducto(id) {
    const producto = state.productos.find(p => p.id === id);
    if (!producto) {
        return;
    }

    productoConfirmandoEliminarId = null;
    productoEditandoId = id;
    productoEditandoOriginal = { ...producto };

    const nombreInput = document.getElementById('prod-nombre');
    const tipoSelect = document.getElementById('prod-tipo');
    const monedaSelect = document.getElementById('prod-moneda');
    const costoInput = document.getElementById('prod-costo');
    const precioInput = document.getElementById('prod-precio');
    const unidadesInput = document.getElementById('prod-unidades');

    if (nombreInput) {
        nombreInput.value = producto.nombre ?? '';
        setTimeout(() => {
            nombreInput.focus();
            if (typeof nombreInput.select === 'function') {
                nombreInput.select();
            }
        }, 0);
    }
    if (tipoSelect && producto.tipo) {
        tipoSelect.value = producto.tipo;
    }
    if (monedaSelect && producto.moneda) {
        monedaSelect.value = producto.moneda;
    }
    if (costoInput) {
        costoInput.value = producto.costoUnitario ?? '';
    }
    if (precioInput) {
        precioInput.value = producto.precioVenta ?? '';
    }
    if (unidadesInput) {
        unidadesInput.value = producto.unidadesVendidas ?? '';
    }

    const titulo = document.getElementById('prod-form-title');
    if (titulo) {
        titulo.textContent = 'Editar Producto/Servicio';
    }

    const submitBtn = document.getElementById('prod-submit');
    if (submitBtn) {
        submitBtn.textContent = '💾 Guardar Cambios';
    }

    const cancelarBtn = document.getElementById('prod-cancelar');
    if (cancelarBtn) {
        cancelarBtn.style.display = 'inline-flex';
    }

    actualizarListaProductos();
}

function cancelarEdicionProducto() {
    productoEditandoId = null;
    productoEditandoOriginal = null;
    productoConfirmandoEliminarId = null;

    const nombreInput = document.getElementById('prod-nombre');
    const costoInput = document.getElementById('prod-costo');
    const precioInput = document.getElementById('prod-precio');
    const unidadesInput = document.getElementById('prod-unidades');
    const titulo = document.getElementById('prod-form-title');
    const submitBtn = document.getElementById('prod-submit');
    const cancelarBtn = document.getElementById('prod-cancelar');

    if (nombreInput) nombreInput.value = '';
    if (costoInput) costoInput.value = '';
    if (precioInput) precioInput.value = '';
    if (unidadesInput) unidadesInput.value = '';
    if (titulo) titulo.textContent = 'Agregar Producto/Servicio';
    if (submitBtn) submitBtn.textContent = '➕ Agregar Producto';
    if (cancelarBtn) cancelarBtn.style.display = 'none';

    actualizarListaProductos();
}

function mostrarAdvertenciaEliminarProducto(id) {
    if (productoConfirmandoEliminarId === id) {
        productoConfirmandoEliminarId = null;
    } else {
        productoConfirmandoEliminarId = id;
    }
    actualizarListaProductos();
}

function cancelarEliminacionProducto() {
    if (productoConfirmandoEliminarId !== null) {
        productoConfirmandoEliminarId = null;
        actualizarListaProductos();
    }
}

function confirmarEliminacionProducto(id) {
    eliminarProducto(id);
}

async function eliminarProducto(id) {
    const indiceProducto = state.productos.findIndex(p => p.id === id);
    const productoEliminado = indiceProducto >= 0 ? state.productos[indiceProducto] : null;
    if (!productoEliminado) {
        return;
    }

    const cliente = obtenerClienteSupabase();
    const puedeSincronizar = cliente && usuarioActual && usuarioActual.id;

    if (puedeSincronizar) {
        try {
            const { error } = await cliente
                .from('productos')
                .delete()
                .eq('id', id)
                .eq('usuario_id', usuarioActual.id);

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error al eliminar producto en Supabase:', error);
            alert('No se pudo eliminar el producto de la base de datos. Intenta nuevamente.');
            return;
        }
    }

    if (productoEditandoId === id) {
        cancelarEdicionProducto();
    }

    productoConfirmandoEliminarId = null;
    state.productos.splice(indiceProducto, 1);
    actualizarVistas();
    guardarDatos();
}

// CRUD Costos Fijos
async function agregarCostoFijo() {
    const conceptoInput = document.getElementById('costo-concepto');
    const monedaSelect = document.getElementById('costo-moneda');
    const montoInput = document.getElementById('costo-monto');
    const frecuenciaSelect = document.getElementById('costo-frecuencia');

    const concepto = conceptoInput ? conceptoInput.value.trim() : '';
    const moneda = monedaSelect ? monedaSelect.value : 'CRC';
    const monto = montoInput ? parseFloat(montoInput.value) || 0 : 0;
    const frecuencia = frecuenciaSelect ? frecuenciaSelect.value : 'mensual';

    if (!concepto || monto <= 0) {
        alert('Por favor completa todos los campos requeridos');
        if (!concepto && conceptoInput) {
            conceptoInput.focus();
        } else if (monto <= 0 && montoInput) {
            montoInput.focus();
        }
        return;
    }

    if (costoFijoEditandoId !== null) {
        const indice = state.costosFijos.findIndex(c => c.id === costoFijoEditandoId);
        if (indice === -1) {
            alert('No se encontró el costo fijo que intentas editar.');
            cancelarEdicionCostoFijo();
            return;
        }

        const costoAnterior = costoFijoEditandoOriginal
            ? { ...costoFijoEditandoOriginal }
            : { ...state.costosFijos[indice] };

        let costoActualizado = {
            ...state.costosFijos[indice],
            concepto,
            moneda,
            monto,
            frecuencia
        };

        state.costosFijos[indice] = costoActualizado;
        actualizarVistas();
        guardarDatos();

        const cliente = obtenerClienteSupabase();
        if (cliente && usuarioActual && usuarioActual.id) {
            try {
                const { data, error } = await cliente
                    .from('costos_fijos')
                    .update({
                        concepto,
                        moneda,
                        monto,
                        frecuencia
                    })
                    .eq('id', costoFijoEditandoId)
                    .eq('usuario_id', usuarioActual.id)
                    .select('id, concepto, moneda, monto, frecuencia')
                    .single();

                if (error) {
                    throw error;
                }

                const costoSupabase = mapearCostoFijoDeSupabase(data);
                if (costoSupabase) {
                    costoActualizado = costoSupabase;
                    state.costosFijos[indice] = costoSupabase;
                }
            } catch (error) {
                console.error('Error al actualizar costo fijo en Supabase:', error);
                state.costosFijos[indice] = costoAnterior;
                costoFijoEditandoOriginal = { ...costoAnterior };
                actualizarVistas();
                guardarDatos();
                alert('No se pudo actualizar el costo fijo en la base de datos. Intenta nuevamente.');
                return;
            }
        } else if (usuarioActual && usuarioActual.id) {
            alert('No se pudo conectar con la base de datos. Los cambios se guardaron localmente.');
        }

        cancelarEdicionCostoFijo();
        actualizarVistas();
        guardarDatos();
        return;
    }

    let costoParaEstado = {
        id: Date.now(),
        concepto,
        moneda,
        monto,
        frecuencia
    };

    const cliente = obtenerClienteSupabase();
    if (cliente && usuarioActual && usuarioActual.id) {
        try {
            const { data, error } = await cliente
                .from('costos_fijos')
                .insert([
                    {
                        usuario_id: usuarioActual.id,
                        concepto,
                        moneda,
                        monto,
                        frecuencia
                    }
                ])
                .select('id, concepto, moneda, monto, frecuencia')
                .single();

            if (error) {
                throw error;
            }

            const costoSupabase = mapearCostoFijoDeSupabase(data);
            if (costoSupabase) {
                costoParaEstado = costoSupabase;
            }
        } catch (error) {
            console.error('Error al guardar costo fijo en Supabase:', error);
            alert('El costo fijo se guardó localmente pero no en la base de datos. Intenta nuevamente cuando tengas conexión.');
        }
    } else if (usuarioActual && usuarioActual.id) {
        alert('No se pudo conectar con la base de datos. El costo fijo se guardará localmente.');
    }

    state.costosFijos.push(costoParaEstado);

    if (conceptoInput) conceptoInput.value = '';
    if (montoInput) montoInput.value = '';
    if (monedaSelect) monedaSelect.value = 'CRC';
    if (frecuenciaSelect) frecuenciaSelect.value = 'mensual';

    costoFijoConfirmandoEliminarId = null;

    actualizarVistas();
    guardarDatos();
}

function prepararEdicionCostoFijo(id) {
    const costo = state.costosFijos.find(c => c.id === id);
    if (!costo) {
        return;
    }

    costoFijoConfirmandoEliminarId = null;
    costoFijoEditandoId = id;
    costoFijoEditandoOriginal = { ...costo };

    const conceptoInput = document.getElementById('costo-concepto');
    const monedaSelect = document.getElementById('costo-moneda');
    const montoInput = document.getElementById('costo-monto');
    const frecuenciaSelect = document.getElementById('costo-frecuencia');
    const titulo = document.getElementById('costo-form-title');
    const submitBtn = document.getElementById('costo-submit');
    const cancelarBtn = document.getElementById('costo-cancelar');

    if (conceptoInput) {
        conceptoInput.value = costo.concepto ?? '';
        setTimeout(() => {
            conceptoInput.focus();
            if (typeof conceptoInput.select === 'function') {
                conceptoInput.select();
            }
        }, 0);
    }
    if (monedaSelect && costo.moneda) {
        monedaSelect.value = costo.moneda;
    }
    if (montoInput) {
        montoInput.value = costo.monto ?? '';
    }
    if (frecuenciaSelect && costo.frecuencia) {
        frecuenciaSelect.value = costo.frecuencia;
    }
    if (titulo) {
        titulo.textContent = 'Editar Costo Fijo';
    }
    if (submitBtn) {
        submitBtn.textContent = '💾 Guardar Cambios';
    }
    if (cancelarBtn) {
        cancelarBtn.style.display = 'inline-flex';
    }

    actualizarListaCostos();
}

function cancelarEdicionCostoFijo() {
    costoFijoEditandoId = null;
    costoFijoEditandoOriginal = null;
    costoFijoConfirmandoEliminarId = null;

    const conceptoInput = document.getElementById('costo-concepto');
    const monedaSelect = document.getElementById('costo-moneda');
    const montoInput = document.getElementById('costo-monto');
    const frecuenciaSelect = document.getElementById('costo-frecuencia');
    const titulo = document.getElementById('costo-form-title');
    const submitBtn = document.getElementById('costo-submit');
    const cancelarBtn = document.getElementById('costo-cancelar');

    if (conceptoInput) conceptoInput.value = '';
    if (monedaSelect) monedaSelect.value = 'CRC';
    if (montoInput) montoInput.value = '';
    if (frecuenciaSelect) frecuenciaSelect.value = 'mensual';
    if (titulo) titulo.textContent = 'Agregar Costo Fijo';
    if (submitBtn) submitBtn.textContent = '➕ Agregar Costo Fijo';
    if (cancelarBtn) cancelarBtn.style.display = 'none';

    actualizarListaCostos();
}

function mostrarAdvertenciaEliminarCostoFijo(id) {
    if (costoFijoConfirmandoEliminarId === id) {
        costoFijoConfirmandoEliminarId = null;
    } else {
        costoFijoConfirmandoEliminarId = id;
    }
    actualizarListaCostos();
}

function cancelarEliminacionCostoFijo() {
    if (costoFijoConfirmandoEliminarId !== null) {
        costoFijoConfirmandoEliminarId = null;
        actualizarListaCostos();
    }
}

function confirmarEliminacionCostoFijo(id) {
    eliminarCostoFijo(id);
}

async function eliminarCostoFijo(id) {
    const indice = state.costosFijos.findIndex(c => c.id === id);
    if (indice === -1) {
        return;
    }

    const cliente = obtenerClienteSupabase();
    const puedeSincronizar = cliente && usuarioActual && usuarioActual.id;

    if (puedeSincronizar) {
        try {
            const { error } = await cliente
                .from('costos_fijos')
                .delete()
                .eq('id', id)
                .eq('usuario_id', usuarioActual.id);

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error al eliminar costo fijo en Supabase:', error);
            alert('No se pudo eliminar el costo fijo de la base de datos. Intenta nuevamente.');
            return;
        }
    }

    if (costoFijoEditandoId === id) {
        cancelarEdicionCostoFijo();
    } else {
        costoFijoConfirmandoEliminarId = null;
    }

    state.costosFijos.splice(indice, 1);
    actualizarVistas();
    guardarDatos();
}

// CRUD Transacciones
async function agregarTransaccion() {
    const fecha = document.getElementById('trans-fecha').value;
    const tipo = document.getElementById('trans-tipo').value;
    const concepto = document.getElementById('trans-concepto').value;
    const moneda = document.getElementById('trans-moneda').value;
    const monto = parseFloat(document.getElementById('trans-monto').value) || 0;
    const categoria = document.getElementById('trans-categoria').value;

    if (!fecha || !tipo || !concepto || !moneda || !categoria || monto <= 0) {
        alert('Por favor completa todos los campos requeridos');
        return;
    }

    const transaccionDatos = { fecha, tipo, concepto, moneda, monto, categoria };
    const cliente = obtenerClienteSupabase();
    const puedeSincronizar = cliente && usuarioActual && usuarioActual.id;

    if (transaccionEditandoId !== null) {
        const indice = state.transacciones.findIndex(t => t.id === transaccionEditandoId);
        if (indice === -1) {
            alert('No se encontró la transacción a actualizar.');
            cancelarEdicionTransaccion();
            return;
        }

        if (puedeSincronizar) {
            try {
                const { error } = await cliente
                    .from('flujo_caja')
                    .update({
                        fecha,
                        tipo,
                        categoria,
                        concepto,
                        moneda,
                        monto
                    })
                    .eq('id', transaccionEditandoId)
                    .eq('usuario_id', usuarioActual.id);

                if (error) {
                    throw error;
                }
            } catch (error) {
                console.error('Error al actualizar la transacción en Supabase:', error);
                alert('No se pudo actualizar la transacción en la base de datos. Intenta nuevamente.');
                return;
            }
        }

        state.transacciones[indice] = {
            ...state.transacciones[indice],
            ...transaccionDatos
        };

        cancelarEdicionTransaccion();
        actualizarVistas();
        guardarDatos();
        return;
    }

    const nuevaTransaccion = {
        id: Date.now(),
        ...transaccionDatos
    };

    if (puedeSincronizar) {
        try {
            const { data, error } = await cliente
                .from('flujo_caja')
                .insert([{ ...transaccionDatos, usuario_id: usuarioActual.id }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            if (data && data.id) {
                nuevaTransaccion.id = data.id;
            }
        } catch (error) {
            console.error('Error al crear la transacción en Supabase:', error);
            alert('No se pudo crear la transacción en la base de datos. Intenta nuevamente.');
            return;
        }
    }

    state.transacciones.push(nuevaTransaccion);

    document.getElementById('trans-concepto').value = '';
    document.getElementById('trans-monto').value = '';

    actualizarVistas();
    guardarDatos();
}

async function eliminarTransaccion(id) {
    const transaccion = state.transacciones.find(t => t.id === id);
    if (!transaccion) {
        return;
    }

    const cliente = obtenerClienteSupabase();
    const puedeSincronizar = cliente && usuarioActual && usuarioActual.id;

    if (puedeSincronizar) {
        try {
            const { error } = await cliente
                .from('flujo_caja')
                .delete()
                .eq('id', id)
                .eq('usuario_id', usuarioActual.id);

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Error al eliminar la transacción en Supabase:', error);
            alert('No se pudo eliminar la transacción de la base de datos. Intenta nuevamente.');
            return;
        }
    }

    if (transaccionEditandoId === id) {
        cancelarEdicionTransaccion();
    } else {
        transaccionConfirmandoEliminarId = null;
    }

    state.transacciones = state.transacciones.filter(t => t.id !== id);
    actualizarVistas();
    guardarDatos();
}

function actualizarCategorias() {
    const tipoSelect = document.getElementById('trans-tipo');
    const select = document.getElementById('trans-categoria');

    if (!tipoSelect || !select) {
        return;
    }

    const tipo = tipoSelect.value;

    if (tipo === 'ingreso') {
        select.innerHTML = `
            <option value="venta">Venta</option>
            <option value="servicio">Servicio</option>
            <option value="otro">Otro</option>
        `;
    } else {
        select.innerHTML = `
            <option value="compra">Compra</option>
            <option value="salario">Salario</option>
            <option value="alquiler">Alquiler</option>
            <option value="servicios">Servicios</option>
            <option value="otro">Otro</option>
        `;
    }
}

function prepararEdicionTransaccion(id) {
    const transaccion = state.transacciones.find(t => t.id === id);
    if (!transaccion) {
        return;
    }

    transaccionEditandoId = id;
    transaccionEditandoOriginal = { ...transaccion };
    transaccionConfirmandoEliminarId = null;

    const fechaInput = document.getElementById('trans-fecha');
    const tipoSelect = document.getElementById('trans-tipo');
    const conceptoInput = document.getElementById('trans-concepto');
    const monedaSelect = document.getElementById('trans-moneda');
    const montoInput = document.getElementById('trans-monto');
    const categoriaSelect = document.getElementById('trans-categoria');
    const titulo = document.getElementById('trans-form-title');
    const submitBtn = document.getElementById('trans-submit');
    const cancelarBtn = document.getElementById('trans-cancelar');

    if (fechaInput) fechaInput.value = transaccion.fecha;
    if (tipoSelect) {
        tipoSelect.value = transaccion.tipo;
        actualizarCategorias();
    }
    if (conceptoInput) conceptoInput.value = transaccion.concepto;
    if (monedaSelect) monedaSelect.value = transaccion.moneda;
    if (montoInput) montoInput.value = transaccion.monto;
    if (categoriaSelect) categoriaSelect.value = transaccion.categoria;
    if (titulo) titulo.textContent = 'Editar Transacción';
    if (submitBtn) submitBtn.textContent = '💾 Guardar Cambios';
    if (cancelarBtn) cancelarBtn.style.display = 'inline-flex';

    actualizarListaTransacciones();
}

function cancelarEdicionTransaccion() {
    transaccionEditandoId = null;
    transaccionEditandoOriginal = null;
    transaccionConfirmandoEliminarId = null;

    const conceptoInput = document.getElementById('trans-concepto');
    const montoInput = document.getElementById('trans-monto');
    const titulo = document.getElementById('trans-form-title');
    const submitBtn = document.getElementById('trans-submit');
    const cancelarBtn = document.getElementById('trans-cancelar');

    if (conceptoInput) conceptoInput.value = '';
    if (montoInput) montoInput.value = '';
    if (titulo) titulo.textContent = 'Agregar Transacción';
    if (submitBtn) submitBtn.textContent = '➕ Agregar Transacción';
    if (cancelarBtn) cancelarBtn.style.display = 'none';

    actualizarCategorias();
    actualizarListaTransacciones();
}

function mostrarAdvertenciaEliminarTransaccion(id) {
    if (transaccionConfirmandoEliminarId === id) {
        transaccionConfirmandoEliminarId = null;
    } else {
        transaccionConfirmandoEliminarId = id;
    }
    actualizarListaTransacciones();
}

function cancelarEliminacionTransaccion() {
    if (transaccionConfirmandoEliminarId !== null) {
        transaccionConfirmandoEliminarId = null;
        actualizarListaTransacciones();
    }
}

function confirmarEliminacionTransaccion(id) {
    eliminarTransaccion(id);
}

// Cálculos
function calcularMargenContribucion(producto) {
    const costoEnMonedaActual = convertirMoneda(producto.costoUnitario, producto.moneda, state.moneda);
    const precioEnMonedaActual = convertirMoneda(producto.precioVenta, producto.moneda, state.moneda);
    return precioEnMonedaActual - costoEnMonedaActual;
}

function calcularMargenPorcentaje(producto) {
    if (producto.precioVenta === 0) return 0;
    return ((producto.precioVenta - producto.costoUnitario) / producto.precioVenta * 100);
}

function calcularCostosFijosTotales() {
    return state.costosFijos.reduce((total, costo) => {
        const montoEnMonedaActual = convertirMoneda(costo.monto, costo.moneda, state.moneda);
        const montoMensual = costo.frecuencia === 'anual' ? montoEnMonedaActual / 12 : montoEnMonedaActual;
        return total + montoMensual;
    }, 0);
}

function calcularPuntoEquilibrio() {
    const costosFijosTotales = calcularCostosFijosTotales();
    const margenPromedio = state.productos.length > 0
        ? state.productos.reduce((sum, p) => sum + calcularMargenContribucion(p), 0) / state.productos.length
        : 0;
    
    if (margenPromedio === 0) return { unidades: 0, ventas: 0 };
    
    const unidades = Math.ceil(costosFijosTotales / margenPromedio);
    const precioPromedio = state.productos.length > 0
        ? state.productos.reduce((sum, p) => sum + convertirMoneda(p.precioVenta, p.moneda, state.moneda), 0) / state.productos.length
        : 0;
    const ventas = unidades * precioPromedio;
    
    return { unidades, ventas };
}

// Actualización de Vistas
function actualizarVistas() {
    if (!document.getElementById('lista-productos')) {
        return;
    }
    actualizarListaProductos();
    actualizarListaCostos();
    actualizarListaTransacciones();
    actualizarFlujoCaja();
    actualizarAnalisis();
}

function actualizarListaProductos() {
    const lista = document.getElementById('lista-productos');

    if (!lista) {
        return;
    }

    if (productoConfirmandoEliminarId !== null) {
        const existe = state.productos.some(p => p.id === productoConfirmandoEliminarId);
        if (!existe) {
            productoConfirmandoEliminarId = null;
        }
    }

    if (state.productos.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <svg class="icon">
                    <rect x="4" y="3" width="16" height="18" rx="2"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="16" y1="7" x2="8" y2="7"/>
                </svg>
                <p>No hay productos registrados</p>
                <p style="font-size: 14px;">Agrega tu primer producto o servicio</p>
            </div>
        `;
        return;
    }
    
    lista.innerHTML = state.productos.map(producto => {
        const margen = calcularMargenContribucion(producto);
        const margenPorcentaje = calcularMargenPorcentaje(producto);
        const editando = productoEditandoId === producto.id;
        const confirmandoEliminacion = productoConfirmandoEliminarId === producto.id;
        const clasesTarjeta = [
            'product-card',
            editando ? 'editing' : '',
            confirmandoEliminacion ? 'confirming-delete' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${clasesTarjeta}">
                <div class="product-card-header">
                    <div class="product-card-main">
                        <div class="product-card-title">
                            <span class="product-name">${producto.nombre}</span>
                            <span class="badge badge-blue">${producto.tipo}</span>
                            <span class="badge badge-purple">${monedas[producto.moneda].simbolo} ${producto.moneda}</span>
                        </div>
                        <div class="product-metrics-grid">
                            <div class="info-row">
                                <span class="info-label">Costo:</span>
                                <span class="info-value">${formatearMoneda(producto.costoUnitario, producto.moneda)}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Precio:</span>
                                <span class="info-value">${formatearMoneda(producto.precioVenta, producto.moneda)}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Margen:</span>
                                <span class="info-value info-value--positive">${formatearMoneda(margen)} (${margenPorcentaje.toFixed(1)}%)</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Unidades:</span>
                                <span class="info-value">${producto.unidadesVendidas}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Total:</span>
                                <span class="info-value info-value--highlight">${formatearMoneda(producto.precioVenta * producto.unidadesVendidas, producto.moneda)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="product-actions">
                        <button class="product-action-btn edit-btn" onclick="prepararEdicionProducto(${producto.id})" title="Editar producto">
                            <span class="product-action-icon">✏️</span>
                            <span>Editar</span>
                        </button>
                        <button class="product-action-btn delete-btn" onclick="mostrarAdvertenciaEliminarProducto(${producto.id})" title="Eliminar producto">
                            <span class="product-action-icon">🗑️</span>
                            <span>Eliminar</span>
                        </button>
                    </div>
                </div>
                ${confirmandoEliminacion ? `
                    <div class="delete-warning">
                        <div class="warning-content">
                            <span class="warning-icon">⚠️</span>
                            <span class="warning-text">¿Deseas eliminar este registro? Esta acción no se puede deshacer.</span>
                        </div>
                        <div class="warning-actions">
                            <button class="cancel-delete-btn" type="button" onclick="cancelarEliminacionProducto()">Cancelar</button>
                            <button class="confirm-delete-btn" type="button" onclick="confirmarEliminacionProducto(${producto.id})">Eliminar</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function actualizarListaCostos() {
    const lista = document.getElementById('lista-costos');
    if (!lista) {
        return;
    }

    const totalElemento = document.getElementById('total-costos-fijos');
    if (totalElemento) {
        totalElemento.textContent = formatearMoneda(calcularCostosFijosTotales());
    }

    if (costoFijoConfirmandoEliminarId !== null) {
        const existe = state.costosFijos.some(c => c.id === costoFijoConfirmandoEliminarId);
        if (!existe) {
            costoFijoConfirmandoEliminarId = null;
        }
    }

    if (state.costosFijos.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <svg class="icon">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p>No hay costos fijos registrados</p>
                <p style="font-size: 14px;">Agrega tus costos fijos mensuales</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = state.costosFijos.map(costo => {
        const editando = costoFijoEditandoId === costo.id;
        const confirmando = costoFijoConfirmandoEliminarId === costo.id;
        const clasesTarjeta = [
            'cost-card',
            editando ? 'editing' : '',
            confirmando ? 'confirming-delete' : ''
        ].filter(Boolean).join(' ');
        const montoMensual = costo.frecuencia === 'anual' ? costo.monto / 12 : costo.monto;

        return `
            <div class="${clasesTarjeta}">
                <div class="product-card-header">
                    <div class="product-card-main">
                        <div class="product-card-title">
                            <span class="product-name">${costo.concepto}</span>
                            <span class="badge badge-purple">${monedas[costo.moneda].simbolo} ${costo.moneda}</span>
                            <span class="badge badge-blue">${costo.frecuencia}</span>
                        </div>
                        <div class="product-metrics-grid">
                            <div>
                                <span class="info-label">${costo.frecuencia === 'anual' ? 'Monto anual' : 'Monto mensual'}</span>
                                <p class="info-value">${formatearMoneda(costo.monto, costo.moneda)}</p>
                            </div>
                            <div>
                                <span class="info-label">Monto mensual</span>
                                <p class="info-value ${costo.frecuencia === 'anual' ? 'info-value--highlight' : ''}">${formatearMoneda(montoMensual, costo.moneda)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="product-actions">
                        <button class="product-action-btn edit-btn" type="button" onclick="prepararEdicionCostoFijo(${costo.id})">
                            <span class="product-action-icon">✏️</span>
                            <span>Editar</span>
                        </button>
                        <button class="product-action-btn delete-btn" type="button" onclick="mostrarAdvertenciaEliminarCostoFijo(${costo.id})">
                            <span class="product-action-icon">🗑️</span>
                            <span>Eliminar</span>
                        </button>
                    </div>
                </div>
                ${confirmando ? `
                    <div class="delete-warning">
                        <div class="warning-content">
                            <span class="warning-icon">⚠️</span>
                            <span class="warning-text">¿Deseas eliminar este registro? Esta acción no se puede deshacer.</span>
                        </div>
                        <div class="warning-actions">
                            <button class="cancel-delete-btn" type="button" onclick="cancelarEliminacionCostoFijo()">Cancelar</button>
                            <button class="confirm-delete-btn" type="button" onclick="confirmarEliminacionCostoFijo(${costo.id})">Eliminar</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function actualizarListaTransacciones() {
    const lista = document.getElementById('lista-transacciones');
    if (!lista) {
        return;
    }

    const mesSelector = document.getElementById('mes-seleccionado');
    const mes = mesSelector && mesSelector.value ? mesSelector.value : '';
    const transaccionesMes = mes
        ? state.transacciones.filter(t => typeof t.fecha === 'string' && t.fecha.startsWith(mes))
        : [...state.transacciones];

    if (transaccionesMes.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <svg class="icon">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <p>No hay transacciones este mes</p>
                <p style="font-size: 14px;">Registra tus ingresos y egresos</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = transaccionesMes
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .map(trans => {
            const editando = transaccionEditandoId === trans.id;
            const confirmando = transaccionConfirmandoEliminarId === trans.id;
            const clasesTarjeta = [
                'transaction-card',
                editando ? 'editing' : '',
                confirmando ? 'confirming-delete' : ''
            ].filter(Boolean).join(' ');

            return `
                <div class="${clasesTarjeta}">
                    <div class="product-card-header">
                        <div class="product-card-main">
                            <div class="product-card-title">
                                <span class="product-name">${trans.concepto}</span>
                                <span class="badge ${trans.tipo === 'ingreso' ? 'badge-green' : 'badge-red'}">${trans.tipo}</span>
                                <span class="badge badge-blue">${trans.categoria}</span>
                            </div>
                            <div class="product-metrics-grid">
                                <div>
                                    <span class="info-label">Fecha</span>
                                    <p class="info-value">${trans.fecha}</p>
                                </div>
                                <div>
                                    <span class="info-label">Monto</span>
                                    <p class="info-value" style="color: ${trans.tipo === 'ingreso' ? '#48bb78' : '#f56565'};">
                                        ${trans.tipo === 'ingreso' ? '+' : '-'}${formatearMoneda(trans.monto, trans.moneda)}
                                    </p>
                                </div>
                                <div>
                                    <span class="info-label">Moneda</span>
                                    <p class="info-value">${monedas[trans.moneda] ? `${monedas[trans.moneda].simbolo} ${trans.moneda}` : trans.moneda}</p>
                                </div>
                            </div>
                        </div>
                        <div class="product-actions">
                            <button class="product-action-btn edit-btn" type="button" onclick="prepararEdicionTransaccion(${trans.id})">
                                <span class="product-action-icon">✏️</span>
                                <span>Editar</span>
                            </button>
                            <button class="product-action-btn delete-btn" type="button" onclick="mostrarAdvertenciaEliminarTransaccion(${trans.id})">
                                <span class="product-action-icon">🗑️</span>
                                <span>Eliminar</span>
                            </button>
                        </div>
                    </div>
                    ${confirmando ? `
                        <div class="delete-warning">
                            <div class="warning-content">
                                <span class="warning-icon">⚠️</span>
                                <span class="warning-text">¿Deseas eliminar este registro? Esta acción no se puede deshacer.</span>
                            </div>
                            <div class="warning-actions">
                                <button class="cancel-delete-btn" type="button" onclick="cancelarEliminacionTransaccion()">Cancelar</button>
                                <button class="confirm-delete-btn" type="button" onclick="confirmarEliminacionTransaccion(${trans.id})">Eliminar</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
}

function obtenerMesesDisponibles() {
    if (!Array.isArray(state.transacciones)) {
        return [];
    }

    const meses = state.transacciones
        .map(t => (t && typeof t.fecha === 'string') ? t.fecha.slice(0, 7) : null)
        .filter(Boolean);

    return Array.from(new Set(meses)).sort((a, b) => a.localeCompare(b));
}

function asegurarMesSeleccionadoValido() {
    const mesSelector = document.getElementById('mes-seleccionado');
    if (!mesSelector) {
        return;
    }

    if (!mesSelector.dataset.usuarioSeleccion) {
        mesSelector.dataset.usuarioSeleccion = 'false';
    }

    const mesesDisponibles = obtenerMesesDisponibles();

    if (mesesDisponibles.length === 0) {
        mesSelector.value = new Date().toISOString().slice(0, 7);
        mesSelector.dataset.usuarioSeleccion = 'false';
        return;
    }

    const mesActual = mesSelector.value;
    const usuarioSeleccion = mesSelector.dataset.usuarioSeleccion === 'true';

    if (usuarioSeleccion) {
        if (!mesActual) {
            mesSelector.dataset.usuarioSeleccion = 'false';
        }
        return;
    }

    if (!mesActual || !mesesDisponibles.includes(mesActual)) {
        mesSelector.value = mesesDisponibles[mesesDisponibles.length - 1];
    }
}

function actualizarFlujoCaja() {
    asegurarMesSeleccionadoValido();
    const ingresosElemento = document.getElementById('flujo-ingresos');
    const egresosElemento = document.getElementById('flujo-egresos');
    const saldoElemento = document.getElementById('flujo-saldo');
    const saldoCard = document.getElementById('saldo-card');

    if (!ingresosElemento || !egresosElemento || !saldoElemento || !saldoCard) {
        return;
    }

    const mesSelector = document.getElementById('mes-seleccionado');
    const mes = mesSelector && mesSelector.value ? mesSelector.value : '';
    const transaccionesMes = mes
        ? state.transacciones.filter(t => typeof t.fecha === 'string' && t.fecha.startsWith(mes))
        : [...state.transacciones];

    const ingresos = transaccionesMes
        .filter(t => t.tipo === 'ingreso')
        .reduce((sum, t) => sum + convertirMoneda(t.monto, t.moneda, state.moneda), 0);

    const egresos = transaccionesMes
        .filter(t => t.tipo === 'egreso')
        .reduce((sum, t) => sum + convertirMoneda(t.monto, t.moneda, state.moneda), 0);

    const saldo = ingresos - egresos;

    ingresosElemento.textContent = formatearMoneda(ingresos);
    egresosElemento.textContent = formatearMoneda(egresos);
    saldoElemento.textContent = formatearMoneda(saldo);

    if (saldo >= 0) {
        saldoCard.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    } else {
        saldoCard.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    }

    actualizarListaTransacciones();
    actualizarGraficoFlujo();
}

function actualizarAnalisis() {
    const pe = calcularPuntoEquilibrio();
    const ventasActuales = state.productos.reduce((sum, p) => 
        sum + (convertirMoneda(p.precioVenta, p.moneda, state.moneda) * p.unidadesVendidas), 0
    );
    const diferencia = ventasActuales - pe.ventas;
    
    document.getElementById('pe-unidades').textContent = pe.unidades;
    document.getElementById('pe-ventas').textContent = formatearMoneda(pe.ventas);
    document.getElementById('pe-estado').textContent = (diferencia >= 0 ? '+' : '') + formatearMoneda(diferencia);
    
    const estadoCard = document.getElementById('pe-estado-card');
    if (diferencia >= 0) {
        estadoCard.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
    } else {
        estadoCard.style.background = 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
    }
    
    const margenPromedio = state.productos.length > 0
        ? state.productos.reduce((sum, p) => sum + calcularMargenPorcentaje(p), 0) / state.productos.length
        : 0;
    
    document.getElementById('margen-promedio').textContent = margenPromedio.toFixed(1) + '%';
    
    actualizarRecomendaciones();
    actualizarGraficos();
}

function actualizarRecomendaciones() {
    const pe = calcularPuntoEquilibrio();
    const ventasActuales = state.productos.reduce((sum, p) => 
        sum + (convertirMoneda(p.precioVenta, p.moneda, state.moneda) * p.unidadesVendidas), 0
    );
    
    const recomendaciones = [];
    
    if (ventasActuales < pe.ventas) {
        recomendaciones.push({
            tipo: 'warning',
            texto: `Necesitas incrementar tus ventas en ${formatearMoneda(pe.ventas - ventasActuales)} para alcanzar el punto de equilibrio`
        });
    } else {
        recomendaciones.push({
            tipo: 'success',
            texto: `¡Excelente! Estás ${formatearMoneda(ventasActuales - pe.ventas)} por encima del punto de equilibrio`
        });
    }
    
    const margenPromedio = state.productos.length > 0
        ? state.productos.reduce((sum, p) => sum + calcularMargenPorcentaje(p), 0) / state.productos.length
        : 0;
    
    if (margenPromedio < 30 && state.productos.length > 0) {
        recomendaciones.push({
            tipo: 'warning',
            texto: 'Tu margen promedio es bajo. Considera aumentar precios o reducir costos'
        });
    }
    
    if (state.productos.length > 0) {
        const mejorProducto = state.productos.reduce((max, p) => 
            calcularMargenContribucion(p) > calcularMargenContribucion(max) ? p : max
        );
        recomendaciones.push({
            tipo: 'info',
            texto: `"${mejorProducto.nombre}" tiene el mejor margen. Considera enfocarte más en este producto`
        });
    }
    
    document.getElementById('recomendaciones').innerHTML = recomendaciones.map(rec => `
        <div class="alert alert-${rec.tipo}">
            ${rec.tipo === 'success' ? '✅' : rec.tipo === 'warning' ? '⚠️' : 'ℹ️'}
            ${rec.texto}
        </div>
    `).join('');
}

// Gráficos
function inicializarGraficos() {
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    const ctxFlujo = document.getElementById('flujoChart');
    if (ctxFlujo) {
        flujoChart = new Chart(ctxFlujo.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    const ctxMargen = document.getElementById('margenChart');
    if (ctxMargen) {
        margenChart = new Chart(ctxMargen.getContext('2d'), {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    const ctxEquilibrio = document.getElementById('equilibrioChart');
    if (ctxEquilibrio) {
        equilibrioChart = new Chart(ctxEquilibrio.getContext('2d'), {
            type: 'doughnut',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
}

function actualizarGraficos() {
    actualizarGraficoFlujo();
    actualizarGraficoMargen();
    actualizarGraficoEquilibrio();
}

function actualizarGraficoFlujo() {
    if (!flujoChart) return;
    
    const meses = [...new Set(state.transacciones.map(t => t.fecha.slice(0, 7)))].sort();
    const datos = meses.map(mes => {
        const transaccionesMes = state.transacciones.filter(t => t.fecha.startsWith(mes));
        
        const ingresos = transaccionesMes
            .filter(t => t.tipo === 'ingreso')
            .reduce((sum, t) => sum + convertirMoneda(t.monto, t.moneda, state.moneda), 0);
        
        const egresos = transaccionesMes
            .filter(t => t.tipo === 'egreso')
            .reduce((sum, t) => sum + convertirMoneda(t.monto, t.moneda, state.moneda), 0);
        
        return { mes, ingresos, egresos, saldo: ingresos - egresos };
    });
    
    flujoChart.data = {
        labels: datos.map(d => d.mes),
        datasets: [
            {
                label: 'Ingresos',
                data: datos.map(d => d.ingresos),
                borderColor: '#48bb78',
                backgroundColor: 'rgba(72, 187, 120, 0.1)',
                borderWidth: 2
            },
            {
                label: 'Egresos',
                data: datos.map(d => d.egresos),
                borderColor: '#f56565',
                backgroundColor: 'rgba(245, 101, 101, 0.1)',
                borderWidth: 2
            },
            {
                label: 'Saldo',
                data: datos.map(d => d.saldo),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2
            }
        ]
    };
    flujoChart.update();
}

function actualizarGraficoMargen() {
    if (!margenChart) return;
    
    const datos = state.productos.map(p => ({
        nombre: p.nombre,
        margen: calcularMargenContribucion(p),
        porcentaje: calcularMargenPorcentaje(p)
    }));
    
    margenChart.data = {
        labels: datos.map(d => d.nombre),
        datasets: [
            {
                label: `Margen (${monedas[state.moneda].simbolo})`,
                data: datos.map(d => d.margen),
                backgroundColor: '#667eea'
            },
            {
                label: 'Margen %',
                data: datos.map(d => d.porcentaje),
                backgroundColor: '#48bb78'
            }
        ]
    };
    margenChart.update();
}

function actualizarGraficoEquilibrio() {
    if (!equilibrioChart) return;
    
    const pe = calcularPuntoEquilibrio();
    const ventasActuales = state.productos.reduce((sum, p) => 
        sum + (convertirMoneda(p.precioVenta, p.moneda, state.moneda) * p.unidadesVendidas), 0
    );
    
    equilibrioChart.data = {
        labels: ['Ventas Actuales', 'Punto de Equilibrio', 'Diferencia'],
        datasets: [{
            data: [ventasActuales, pe.ventas, Math.abs(ventasActuales - pe.ventas)],
            backgroundColor: ['#667eea', '#f59e0b', ventasActuales >= pe.ventas ? '#48bb78' : '#f56565']
        }]
    };
    equilibrioChart.update();
}

// Gestión de Datos
function guardarDatos() {
    try {
        const clave = obtenerClaveAlmacenamiento();
        localStorage.setItem(clave, JSON.stringify(state));

        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 2000);
        }
    } catch (e) {
        console.error('Error al guardar:', e);
    }
}

function cargarDatos() {
    try {
        const clave = obtenerClaveAlmacenamiento();
        const datos = localStorage.getItem(clave);
        const estadoBase = crearEstadoInicial();
        if (datos) {
            const recuperado = JSON.parse(datos);
            state = {
                ...estadoBase,
                ...recuperado,
                productos: Array.isArray(recuperado.productos) ? recuperado.productos : estadoBase.productos,
                costosFijos: Array.isArray(recuperado.costosFijos) ? recuperado.costosFijos : estadoBase.costosFijos,
                transacciones: Array.isArray(recuperado.transacciones) ? recuperado.transacciones : estadoBase.transacciones
            };
        } else {
            state = estadoBase;
        }
        const selectorMoneda = document.getElementById('selectMoneda');
        if (selectorMoneda) {
            selectorMoneda.value = state.moneda;
        }
        const etiquetaMoneda = document.getElementById('monedaActual');
        if (etiquetaMoneda) {
            etiquetaMoneda.textContent = `${monedas[state.moneda].simbolo} ${state.moneda}`;
        }
        const tasaCambioInput = document.getElementById('tasaCambio');
        if (tasaCambioInput) {
            tasaCambioInput.value = state.tasaCambio;
        }
    } catch (e) {
        console.error('Error al cargar:', e);
        state = crearEstadoInicial();
    }
}

function exportarDatos() {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `sistema_financiero_${new Date().toISOString().split('T')[0]}.json`);
    link.click();
    
    toggleDropdown('dataMenu');
}

function importarDatos(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                state = JSON.parse(e.target.result);
                
                document.getElementById('selectMoneda').value = state.moneda;
                document.getElementById('monedaActual').textContent = `${monedas[state.moneda].simbolo} ${state.moneda}`;
                document.getElementById('tasaCambio').value = state.tasaCambio;
                
                actualizarVistas();
                guardarDatos();
                
                alert('✅ Datos importados correctamente');
                toggleDropdown('dataMenu');
            } catch (error) {
                alert('❌ Error al importar el archivo');
            }
        };
        reader.readAsText(file);
    }
}

function limpiarDatos() {
    if (confirm('⚠️ ¿Estás seguro de eliminar TODOS los datos?')) {
        state = {
            productos: [],
            costosFijos: [],
            transacciones: [],
            moneda: 'CRC',
            tasaCambio: 520
        };
        
        localStorage.removeItem('sistemaFinanciero');
        
        document.getElementById('selectMoneda').value = 'CRC';
        document.getElementById('monedaActual').textContent = '₡ CRC';
        document.getElementById('tasaCambio').value = 520;
        const mesSelector = document.getElementById('mes-seleccionado');
        if (mesSelector) {
            mesSelector.value = new Date().toISOString().slice(0, 7);
            mesSelector.dataset.usuarioSeleccion = 'false';
        }

        actualizarVistas();
        toggleDropdown('dataMenu');
        alert('✅ Datos eliminados');
    }
}
