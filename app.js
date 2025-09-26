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

async function buscarUsuarioEnSupabase(username) {
    const cliente = obtenerClienteSupabase();
    if (!cliente) {
        throw new Error('Supabase no está disponible');
    }

    const patron = username.replace(/[\%_]/g, '\\$&');
    const { data, error } = await cliente
        .from('usuarios')
        .select('id, username')
        .ilike('username', patron)
        .limit(1);

    if (error) {
        throw error;
    }

    return Array.isArray(data) ? data[0] : null;
}

function mapearProductoDesdeSupabase(registro) {
    return {
        id: registro.id,
        nombre: registro.nombre,
        tipo: registro.tipo,
        moneda: registro.moneda,
        costoUnitario: Number(registro.costo_unitario || 0),
        precioVenta: Number(registro.precio_venta || 0),
        unidadesVendidas: Number(registro.unidades_vendidas || 0)
    };
}

async function obtenerProductosDeSupabase(usuarioId) {
    const cliente = obtenerClienteSupabase();
    if (!cliente || !usuarioId) return [];

    const { data, error } = await cliente
        .from('productos')
        .select('id, nombre, tipo, moneda, costo_unitario, precio_venta, unidades_vendidas')
        .eq('usuario_id', usuarioId)
        .order('actualizado_en', { ascending: false });

    if (error) {
        throw error;
    }

    return Array.isArray(data) ? data.map(mapearProductoDesdeSupabase) : [];
}

async function crearProductoEnSupabase(producto, usuarioId) {
    const cliente = obtenerClienteSupabase();
    if (!cliente || !usuarioId) {
        throw new Error('Supabase no está disponible');
    }

    const { data, error } = await cliente
        .from('productos')
        .insert([
            {
                nombre: producto.nombre,
                tipo: producto.tipo,
                moneda: producto.moneda,
                costo_unitario: producto.costoUnitario,
                precio_venta: producto.precioVenta,
                unidades_vendidas: producto.unidadesVendidas,
                usuario_id: usuarioId
            }
        ])
        .select()
        .single();

    if (error) {
        throw error;
    }

    return mapearProductoDesdeSupabase(data);
}

async function actualizarProductoEnSupabase(productoId, producto, usuarioId) {
    const cliente = obtenerClienteSupabase();
    if (!cliente || !usuarioId) {
        throw new Error('Supabase no está disponible');
    }

    const { data, error } = await cliente
        .from('productos')
        .update({
            nombre: producto.nombre,
            tipo: producto.tipo,
            moneda: producto.moneda,
            costo_unitario: producto.costoUnitario,
            precio_venta: producto.precioVenta,
            unidades_vendidas: producto.unidadesVendidas
        })
        .eq('usuario_id', usuarioId)
        .eq('id', productoId)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return mapearProductoDesdeSupabase(data);
}

async function eliminarProductoDeSupabase(productoId, usuarioId) {
    const cliente = obtenerClienteSupabase();
    if (!cliente || !usuarioId) {
        throw new Error('Supabase no está disponible');
    }

    const respuesta = await cliente
        .from('productos')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('id', productoId);

    if (respuesta.error) {
        throw respuesta.error;
    }
}

// Estado Global
let state = {
    productos: [],
    costosFijos: [],
    transacciones: [],
    moneda: 'CRC',
    tasaCambio: 520
};

let usuarioActual = null;
let productoEnEdicionId = null;

// Configuración de monedas
const monedas = {
    CRC: { simbolo: '₡', nombre: 'Colones', decimales: 0 },
    USD: { simbolo: '$', nombre: 'Dólares', decimales: 2 }
};

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
        if (loginError) {
            loginError.textContent = '';
        }
        loginContainer.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        if (loginForm) {
            loginForm.reset();
        }
        inicializarAplicacion();
    };

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            ['usuarioAutenticado', 'usuarioId', 'usuarioNombre'].forEach((clave) => {
                sessionStorage.removeItem(clave);
            });
            usuarioActual = null;
            state.productos = [];
            cancelarEdicionProducto(true);
            localStorage.removeItem('sistemaFinanciero');
            mostrarFormularioLogin();
        });
    }

    const sesionPersistida = sessionStorage.getItem('usuarioAutenticado') === 'true';
    if (sesionPersistida) {
        const usernamePersistido = sessionStorage.getItem('usuarioNombre') || 'admin';
        const idPersistido = sessionStorage.getItem('usuarioId');
        const usuario = { username: usernamePersistido, id: idPersistido ? parseInt(idPersistido, 10) : undefined };
        manejarSesionActiva(usuario);
        sincronizarDatosUsuario(usuario).catch(error => {
            console.error('Error al sincronizar datos de Supabase:', error);
        });
        return;
    }

    mostrarFormularioLogin();

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const usuarioIngresado = loginUsuario ? loginUsuario.value.trim() : '';

        if (loginError) {
            loginError.textContent = '';
        }

        if (!usuarioIngresado) {
            if (loginError) {
                loginError.textContent = 'Por favor, ingresa tu usuario.';
            }
            return;
        }

        const botonOriginal = loginSubmit ? loginSubmit.textContent : '';
        if (loginSubmit) {
            loginSubmit.disabled = true;
            loginSubmit.textContent = 'Verificando...';
        }

        try {
            const usuarioEncontrado = await buscarUsuarioEnSupabase(usuarioIngresado);

            if (!usuarioEncontrado) {
                if (loginError) {
                    loginError.textContent = 'Usuario no autorizado. Verifica tus credenciales.';
                }
                return;
            }

            const usuarioAutenticado = { username: usuarioEncontrado.username, id: usuarioEncontrado.id };
            manejarSesionActiva(usuarioAutenticado);
            await sincronizarDatosUsuario(usuarioAutenticado);
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

async function sincronizarDatosUsuario(usuario) {
    if (!usuario || !usuario.id) return;

    try {
        const productos = await obtenerProductosDeSupabase(usuario.id);
        state.productos = productos;
        cancelarEdicionProducto(true);
        if (document.getElementById('lista-productos')) {
            actualizarVistas();
        }
        guardarDatos(false);
    } catch (error) {
        console.error('Error al cargar productos desde Supabase:', error);
        alert('⚠️ No se pudieron cargar los productos desde la base de datos. Intenta nuevamente más tarde.');
    }
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

    if (!usuarioActual || !usuarioActual.id) {
        alert('Debes iniciar sesión para registrar productos.');
        return;
    }

    if (nombre && costo > 0 && precio > 0) {
        try {
            const producto = {
                nombre,
                tipo,
                moneda,
                costoUnitario: costo,
                precioVenta: precio,
                unidadesVendidas: unidades
            };

            if (productoEnEdicionId) {
                const productoActualizado = await actualizarProductoEnSupabase(productoEnEdicionId, producto, usuarioActual.id);
                const indice = state.productos.findIndex(p => p.id === productoEnEdicionId);
                if (indice >= 0) {
                    state.productos[indice] = productoActualizado;
                }
            } else {
                const productoGuardado = await crearProductoEnSupabase(producto, usuarioActual.id);
                state.productos.push(productoGuardado);
            }

            restablecerFormularioProducto();
            actualizarVistas();
            guardarDatos();
        } catch (error) {
            console.error('Error al guardar producto en Supabase:', error);
            alert('No se pudo guardar el producto. Intenta nuevamente.');
        }
    } else {
        alert('Por favor completa todos los campos requeridos');
    }
}

async function eliminarProducto(id) {
    if (!usuarioActual || !usuarioActual.id) {
        alert('Debes iniciar sesión para gestionar tus productos.');
        return;
    }

    if (confirm('¿Estás seguro de eliminar este producto?')) {
        try {
            await eliminarProductoDeSupabase(id, usuarioActual.id);
            state.productos = state.productos.filter(p => p.id !== id);
            if (productoEnEdicionId === id) {
                cancelarEdicionProducto(true);
            }
            actualizarVistas();
            guardarDatos();
        } catch (error) {
            console.error('Error al eliminar producto en Supabase:', error);
            alert('No se pudo eliminar el producto. Intenta nuevamente.');
        }
    }
}

function editarProducto(id) {
    if (!usuarioActual || !usuarioActual.id) {
        alert('Debes iniciar sesión para gestionar tus productos.');
        return;
    }

    const producto = state.productos.find(p => p.id === id);
    if (!producto) return;

    productoEnEdicionId = id;

    const campos = {
        'prod-nombre': producto.nombre,
        'prod-tipo': producto.tipo,
        'prod-moneda': producto.moneda,
        'prod-costo': producto.costoUnitario,
        'prod-precio': producto.precioVenta,
        'prod-unidades': producto.unidadesVendidas
    };

    Object.entries(campos).forEach(([idCampo, valor]) => {
        const elemento = document.getElementById(idCampo);
        if (elemento) {
            elemento.value = valor;
        }
    });

    const submitButton = document.getElementById('prod-submit');
    const cancelButton = document.getElementById('prod-cancel');
    if (submitButton) {
        submitButton.textContent = '💾 Guardar Cambios';
    }
    if (cancelButton) {
        cancelButton.classList.remove('hidden');
    }
}

function cancelarEdicionProducto(silencioso = false) {
    const estabaEditando = Boolean(productoEnEdicionId);
    restablecerFormularioProducto();

    if (estabaEditando && !silencioso) {
        const submitButton = document.getElementById('prod-submit');
        if (submitButton) {
            submitButton.focus();
        }
    }
}

function restablecerFormularioProducto() {
    ['prod-nombre', 'prod-costo', 'prod-precio', 'prod-unidades'].forEach(idCampo => {
        const campo = document.getElementById(idCampo);
        if (campo) {
            campo.value = '';
        }
    });

    const tipo = document.getElementById('prod-tipo');
    const moneda = document.getElementById('prod-moneda');
    if (tipo) {
        tipo.value = 'producto';
    }
    if (moneda) {
        moneda.value = state.moneda || 'CRC';
    }

    const submitButton = document.getElementById('prod-submit');
    const cancelButton = document.getElementById('prod-cancel');
    if (submitButton) {
        submitButton.textContent = '➕ Agregar Producto';
    }
    if (cancelButton) {
        cancelButton.classList.add('hidden');
    }

    productoEnEdicionId = null;
}

// CRUD Costos Fijos
function agregarCostoFijo() {
    const concepto = document.getElementById('costo-concepto').value;
    const moneda = document.getElementById('costo-moneda').value;
    const monto = parseFloat(document.getElementById('costo-monto').value) || 0;
    const frecuencia = document.getElementById('costo-frecuencia').value;
    
    if (concepto && monto > 0) {
        state.costosFijos.push({
            id: Date.now(),
            concepto,
            moneda,
            monto,
            frecuencia
        });
        
        document.getElementById('costo-concepto').value = '';
        document.getElementById('costo-monto').value = '';
        
        actualizarVistas();
        guardarDatos();
    } else {
        alert('Por favor completa todos los campos requeridos');
    }
}

function eliminarCostoFijo(id) {
    if (confirm('¿Estás seguro de eliminar este costo fijo?')) {
        state.costosFijos = state.costosFijos.filter(c => c.id !== id);
        actualizarVistas();
        guardarDatos();
    }
}

// CRUD Transacciones
function agregarTransaccion() {
    const fecha = document.getElementById('trans-fecha').value;
    const tipo = document.getElementById('trans-tipo').value;
    const concepto = document.getElementById('trans-concepto').value;
    const moneda = document.getElementById('trans-moneda').value;
    const monto = parseFloat(document.getElementById('trans-monto').value) || 0;
    const categoria = document.getElementById('trans-categoria').value;
    
    if (concepto && monto > 0) {
        state.transacciones.push({
            id: Date.now(),
            fecha,
            tipo,
            concepto,
            moneda,
            monto,
            categoria
        });
        
        document.getElementById('trans-concepto').value = '';
        document.getElementById('trans-monto').value = '';
        
        actualizarVistas();
        guardarDatos();
    } else {
        alert('Por favor completa todos los campos requeridos');
    }
}

function eliminarTransaccion(id) {
    if (confirm('¿Estás seguro de eliminar esta transacción?')) {
        state.transacciones = state.transacciones.filter(t => t.id !== id);
        actualizarVistas();
        guardarDatos();
    }
}

function actualizarCategorias() {
    const tipo = document.getElementById('trans-tipo').value;
    const select = document.getElementById('trans-categoria');
    
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
    actualizarListaProductos();
    actualizarListaCostos();
    actualizarListaTransacciones();
    actualizarFlujoCaja();
    actualizarAnalisis();
}

function actualizarListaProductos() {
    const lista = document.getElementById('lista-productos');

    if (!lista) return;

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
        
        return `
            <div class="product-card">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="margin-bottom: 10px;">
                            <span style="font-size: 18px; font-weight: 600; color: #2d3748;">${producto.nombre}</span>
                            <span class="badge badge-blue">${producto.tipo}</span>
                            <span class="badge badge-purple">${monedas[producto.moneda].simbolo} ${producto.moneda}</span>
                        </div>
                        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
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
                                <span class="info-value" style="color: #48bb78;">${formatearMoneda(margen)} (${margenPorcentaje.toFixed(1)}%)</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Unidades:</span>
                                <span class="info-value">${producto.unidadesVendidas}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Total:</span>
                                <span class="info-value" style="color: #667eea;">${formatearMoneda(producto.precioVenta * producto.unidadesVendidas, producto.moneda)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="product-actions">
                        <button class="edit-btn" onclick="editarProducto(${producto.id})" title="Editar ${producto.nombre}">
                            ✏️
                        </button>
                        <button class="delete-btn" onclick="eliminarProducto(${producto.id})" title="Eliminar ${producto.nombre}">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function actualizarListaCostos() {
    const lista = document.getElementById('lista-costos');
    const total = calcularCostosFijosTotales();
    
    document.getElementById('total-costos-fijos').textContent = formatearMoneda(total);
    
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
    
    lista.innerHTML = state.costosFijos.map(costo => `
        <div class="cost-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="margin-bottom: 10px;">
                        <span style="font-size: 18px; font-weight: 600; color: #2d3748;">${costo.concepto}</span>
                        <span class="badge badge-purple">${monedas[costo.moneda].simbolo} ${costo.moneda}</span>
                        <span class="badge badge-blue">${costo.frecuencia}</span>
                    </div>
                    <div style="display: flex; gap: 30px;">
                        <div>
                            <span class="info-label">Monto:</span>
                            <span class="info-value">${formatearMoneda(costo.monto, costo.moneda)}</span>
                        </div>
                        ${costo.frecuencia === 'anual' ? `
                            <div>
                                <span class="info-label">Mensual:</span>
                                <span class="info-value" style="color: #48bb78;">${formatearMoneda(costo.monto / 12, costo.moneda)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <button class="delete-btn" onclick="eliminarCostoFijo(${costo.id})">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

function actualizarListaTransacciones() {
    const lista = document.getElementById('lista-transacciones');
    const mes = document.getElementById('mes-seleccionado').value;
    const transaccionesMes = state.transacciones.filter(t => t.fecha.startsWith(mes));
    
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
        .map(trans => `
            <div class="transaction-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="margin-bottom: 10px;">
                            <span style="font-size: 18px; font-weight: 600; color: #2d3748;">${trans.concepto}</span>
                            <span class="badge ${trans.tipo === 'ingreso' ? 'badge-green' : 'badge-red'}">${trans.tipo}</span>
                            <span class="badge badge-blue">${trans.categoria}</span>
                        </div>
                        <div style="display: flex; gap: 30px;">
                            <div>
                                <span class="info-label">Fecha:</span>
                                <span class="info-value">${trans.fecha}</span>
                            </div>
                            <div>
                                <span class="info-label">Monto:</span>
                                <span class="info-value" style="color: ${trans.tipo === 'ingreso' ? '#48bb78' : '#f56565'};">
                                    ${trans.tipo === 'ingreso' ? '+' : '-'}${formatearMoneda(trans.monto, trans.moneda)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button class="delete-btn" onclick="eliminarTransaccion(${trans.id})">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
}

function actualizarFlujoCaja() {
    const mes = document.getElementById('mes-seleccionado').value;
    const transaccionesMes = state.transacciones.filter(t => t.fecha.startsWith(mes));
    
    const ingresos = transaccionesMes
        .filter(t => t.tipo === 'ingreso')
        .reduce((sum, t) => sum + convertirMoneda(t.monto, t.moneda, state.moneda), 0);
    
    const egresos = transaccionesMes
        .filter(t => t.tipo === 'egreso')
        .reduce((sum, t) => sum + convertirMoneda(t.monto, t.moneda, state.moneda), 0);
    
    const saldo = ingresos - egresos;
    
    document.getElementById('flujo-ingresos').textContent = formatearMoneda(ingresos);
    document.getElementById('flujo-egresos').textContent = formatearMoneda(egresos);
    document.getElementById('flujo-saldo').textContent = formatearMoneda(saldo);
    
    const saldoCard = document.getElementById('saldo-card');
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
function guardarDatos(mostrarAviso = true) {
    try {
        localStorage.setItem('sistemaFinanciero', JSON.stringify(state));

        if (mostrarAviso) {
            const loading = document.getElementById('loading');
            if (loading) {
                loading.style.display = 'block';
                setTimeout(() => {
                    loading.style.display = 'none';
                }, 2000);
            }
        }
    } catch (e) {
        console.error('Error al guardar:', e);
    }
}

function cargarDatos() {
    try {
        const datos = localStorage.getItem('sistemaFinanciero');
        if (datos) {
            state = JSON.parse(datos);
            document.getElementById('selectMoneda').value = state.moneda;
            document.getElementById('monedaActual').textContent = `${monedas[state.moneda].simbolo} ${state.moneda}`;
            document.getElementById('tasaCambio').value = state.tasaCambio;
        }
    } catch (e) {
        console.error('Error al cargar:', e);
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
        
        actualizarVistas();
        toggleDropdown('dataMenu');
        alert('✅ Datos eliminados');
    }
}
