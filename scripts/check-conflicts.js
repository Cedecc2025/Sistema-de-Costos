#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function listarArchivosSeguimiento() {
    try {
        const salida = execSync('git ls-files', { encoding: 'utf8' });
        return salida.split('\n').map(linea => linea.trim()).filter(Boolean);
    } catch (error) {
        throw new Error(`No se pudieron obtener los archivos versionados: ${error.message}`);
    }
}

function buscarMarcadoresConflicto(archivo) {
    const contenido = fs.readFileSync(archivo, 'utf8');
    const lineas = contenido.split(/\r?\n/);
    const marcadores = ['<<<<<<<', '=======', '>>>>>>>'];
    const hallazgos = [];

    lineas.forEach((linea, indice) => {
        if (marcadores.some(marcador => linea.startsWith(marcador))) {
            hallazgos.push({
                archivo,
                linea: indice + 1,
                contenido: linea.trim()
            });
        }
    });

    return hallazgos;
}

function main() {
    const archivos = listarArchivosSeguimiento();
    const conflictos = archivos.flatMap(buscarMarcadoresConflicto);

    if (conflictos.length > 0) {
        console.error('Se detectaron marcadores de conflicto en los siguientes archivos:');
        conflictos.forEach(conflicto => {
            console.error(` - ${conflicto.archivo}:${conflicto.linea} -> ${conflicto.contenido}`);
        });
        process.exit(1);
    }

    console.log('Sin marcadores de conflicto en los archivos versionados.');
}

try {
    main();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
