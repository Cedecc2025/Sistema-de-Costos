const productosMock = [];
let usuariosMock = [];
let ultimoProductoId = 0;

function resetSupabaseState({ usuarios = [{ id: 1, username: 'admin' }], productos = [] } = {}) {
    usuariosMock = usuarios.map(usuario => ({ ...usuario }));
    productosMock.length = 0;
    ultimoProductoId = 0;

    productos.forEach(producto => {
        const copia = { ...producto };
        if (!copia.id) {
            ultimoProductoId += 1;
            copia.id = ultimoProductoId;
        } else {
            ultimoProductoId = Math.max(ultimoProductoId, copia.id);
        }
        productosMock.push(copia);
    });
}

function normalizarUsuario(valor) {
    return String(valor || '')
        .trim()
        .toLowerCase()
        .replace(/^%|%$/g, '');
}

function crearUsuariosBuilder() {
    return {
        select() {
            return {
                ilike(_columna, valor) {
                    return {
                        limit() {
                            const username = normalizarUsuario(valor);
                            const usuario = usuariosMock.find(u => u.username.toLowerCase() === username);
                            return Promise.resolve({
                                data: usuario ? [usuario] : [],
                                error: null
                            });
                        }
                    };
                }
            };
        }
    };
}

function crearProductosSelectBuilder() {
    const filtros = {};
    return {
        _filters: filtros,
        eq(columna, valor) {
            filtros[columna] = valor;
            return this;
        },
        order() {
            let resultados = productosMock.slice();
            if (typeof filtros.usuario_id !== 'undefined') {
                resultados = resultados.filter(producto => producto.usuario_id === filtros.usuario_id);
            }
            resultados = resultados
                .map(producto => ({ ...producto }))
                .sort((a, b) => {
                    const valorA = new Date(a.actualizado_en || 0).getTime() || a.id;
                    const valorB = new Date(b.actualizado_en || 0).getTime() || b.id;
                    return valorB - valorA;
                });
            return Promise.resolve({ data: resultados, error: null });
        }
    };
}

function crearProductosInsertBuilder(registros) {
    const nuevos = registros.map((registro) => {
        ultimoProductoId += 1;
        const base = {
            id: ultimoProductoId,
            actualizado_en: new Date().toISOString(),
            ...registro
        };
        productosMock.push(base);
        return base;
    });

    return {
        select() {
            return {
                single() {
                    return Promise.resolve({ data: nuevos[0], error: null });
                }
            };
        }
    };
}

function crearProductosUpdateBuilder(valores) {
    const filtros = {};
    const cambios = { ...valores };

    return {
        eq(columna, valor) {
            filtros[columna] = valor;
            return this;
        },
        select() {
            return {
                single() {
                    const indice = productosMock.findIndex(producto => {
                        return (
                            (typeof filtros.id === 'undefined' || producto.id === filtros.id) &&
                            (typeof filtros.usuario_id === 'undefined' || producto.usuario_id === filtros.usuario_id)
                        );
                    });

                    if (indice === -1) {
                        return Promise.resolve({ data: null, error: null });
                    }

                    productosMock[indice] = {
                        ...productosMock[indice],
                        ...cambios,
                        actualizado_en: new Date().toISOString()
                    };

                    return Promise.resolve({ data: productosMock[indice], error: null });
                }
            };
        }
    };
}

function crearProductosDeleteBuilder() {
    const filtros = {};
    return {
        eq(columna, valor) {
            filtros[columna] = valor;
            if (typeof filtros.id !== 'undefined' && typeof filtros.usuario_id !== 'undefined') {
                const indice = productosMock.findIndex(producto =>
                    producto.id === filtros.id && producto.usuario_id === filtros.usuario_id
                );
                if (indice >= 0) {
                    productosMock.splice(indice, 1);
                }
                return Promise.resolve({ data: null, error: null });
            }
            return this;
        }
    };
}

function crearProductosBuilder() {
    return {
        select() {
            return crearProductosSelectBuilder();
        },
        insert(registros) {
            return crearProductosInsertBuilder(registros);
        },
        update(valores) {
            return crearProductosUpdateBuilder(valores);
        },
        delete() {
            return crearProductosDeleteBuilder();
        }
    };
}

function crearClienteSupabaseMock() {
    return {
        from(tabla) {
            if (tabla === 'usuarios') {
                return crearUsuariosBuilder();
            }
            if (tabla === 'productos') {
                return crearProductosBuilder();
            }
            return {
                select() {
                    return {
                        eq() {
                            return Promise.resolve({ data: [], error: null });
                        }
                    };
                }
            };
        }
    };
}

function attachSupabase(windowObj) {
    const supabaseMock = {
        createClient: () => crearClienteSupabaseMock()
    };

    if (windowObj) {
        windowObj.supabase = supabaseMock;
    }
    if (typeof global !== 'undefined') {
        global.supabase = supabaseMock;
    }

    return supabaseMock;
}

module.exports = {
    attachSupabase,
    resetSupabaseState,
    productosMock
};
