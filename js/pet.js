/*
 * pet.js — Dibuja la mascota como pixel art en SVG (grilla de 16×16).
 * Cuerpo según la etapa (huevo, bebé, joven, adulta) y cara según el estado.
 */
(function (AQ) {
  'use strict';

  const OSCURO = '#12141C';
  const HOJA = '#7BE0A8';
  const TALLO = '#8FB03E';
  const MEJILLA = '#FF9E7A';
  const LAGRIMA = '#6EC5FF';

  // Cada píxel o bloque: [x, y, ancho, alto, color opcional]. Sin color = color del cuerpo.
  const CUERPOS = {
    huevo: [
      [6, 2, 4, 1, '#EDE6D3'], [5, 3, 6, 1, '#EDE6D3'], [4, 4, 8, 2, '#EDE6D3'], [3, 6, 10, 6, '#EDE6D3'],
      [4, 12, 8, 1, '#EDE6D3'], [5, 13, 6, 1, '#EDE6D3'],
      [6, 5, 2, 2, '#C6F25B'], [9, 8, 2, 2, '#C6F25B'], [5, 10, 2, 1, '#C6F25B'], [8, 12, 2, 1, '#C6F25B']
    ],
    bebe: [[4, 6, 8, 1], [3, 7, 10, 6], [4, 13, 8, 1], [7, 5, 2, 1, HOJA]],
    joven: [
      [7, 2, 2, 2, TALLO], [5, 1, 2, 2, HOJA], [9, 1, 2, 2, HOJA],
      [3, 4, 10, 1], [2, 5, 12, 8], [3, 13, 10, 1], [4, 14, 2, 1], [10, 14, 2, 1]
    ],
    adulto: [
      [4, 1, 2, 2, HOJA], [7, 0, 2, 3, TALLO], [10, 1, 2, 2, HOJA],
      [3, 3, 10, 1], [2, 4, 12, 1], [1, 5, 14, 8], [2, 13, 12, 1],
      [0, 8, 1, 3], [15, 8, 1, 3], [3, 14, 3, 1], [10, 14, 3, 1]
    ]
  };

  const ALTURA_CARA = { bebe: 8, joven: 7, adulto: 6 };

  // Caras con coordenadas relativas a la fila de los ojos.
  const CARAS = {
    feliz: [[4, 1, 1, 1], [5, 0, 1, 1], [6, 1, 1, 1], [9, 1, 1, 1], [10, 0, 1, 1], [11, 1, 1, 1],
      [3, 2, 1, 1, MEJILLA], [12, 2, 1, 1, MEJILLA], [6, 3, 1, 1], [9, 3, 1, 1], [7, 4, 2, 1]],
    tranquilo: [[5, 0, 1, 2], [10, 0, 1, 2], [6, 3, 1, 1], [9, 3, 1, 1], [7, 4, 2, 1]],
    hambriento: [[5, 0, 1, 2], [10, 0, 1, 2], [6, 3, 4, 2], [7, 4, 2, 1, MEJILLA], [9, 5, 1, 1, LAGRIMA]],
    preocupado: [[4, -1, 1, 1], [5, -2, 1, 1], [11, -1, 1, 1], [10, -2, 1, 1], [5, 0, 1, 2], [10, 0, 1, 2],
      [6, 4, 1, 1], [7, 3, 2, 1], [9, 4, 1, 1], [13, -1, 1, 2, LAGRIMA]],
    debil: [[4, 1, 2, 1], [10, 1, 2, 1], [4, 0, 1, 1], [11, 0, 1, 1], [7, 4, 2, 1], [13, -3, 2, 1, '#8A8FA3'], [14, -4, 1, 1, '#8A8FA3']],
    triste: [[4, 0, 1, 1], [5, -1, 1, 1], [11, 0, 1, 1], [10, -1, 1, 1], [4, 1, 2, 1], [10, 1, 2, 1],
      [4, 2, 1, 2, LAGRIMA], [6, 3, 4, 1], [5, 4, 1, 1], [10, 4, 1, 1]]
  };

  function rects(lista, colorBase, dy) {
    return lista.map(([x, y, w, h, c]) =>
      '<rect x="' + x + '" y="' + (y + (dy || 0)) + '" width="' + w + '" height="' + h + '" fill="' + (c || colorBase) + '"></rect>'
    ).join('');
  }

  // Grietas del huevo: aparecen a medida que el padre valida tareas.
  const GRIETA = '#4E4838';
  const GRIETAS = [
    [],
    [[4, 7, 1, 1], [5, 8, 1, 1], [6, 7, 1, 1], [7, 8, 1, 1]],
    [[4, 7, 1, 1], [5, 8, 1, 1], [6, 7, 1, 1], [7, 8, 1, 1], [8, 7, 1, 1], [9, 8, 1, 1], [10, 7, 1, 1], [11, 8, 1, 1], [7, 9, 1, 1], [7, 10, 1, 1]],
    [[3, 7, 1, 1], [4, 7, 1, 1], [5, 8, 1, 1], [6, 7, 1, 1], [7, 8, 1, 1], [8, 7, 1, 1], [9, 8, 1, 1], [10, 7, 1, 1], [11, 8, 1, 1], [12, 7, 1, 1],
      [7, 9, 1, 1], [7, 10, 1, 1], [9, 5, 1, 1], [9, 6, 1, 1]]
  ];

  function svg(contenido, tam, alt) {
    return '<svg class="mascota-svg" width="' + tam + '" height="' + tam + '" viewBox="0 0 16 16" shape-rendering="crispEdges"' +
      (alt ? ' role="img" aria-label="' + alt + '"' : ' aria-hidden="true"') + '>' + contenido + '</svg>';
  }

  const NOMBRE_ESTADO = { feliz: 'feliz', tranquilo: 'con la panza llena', hambriento: 'con hambre', preocupado: 'preocupada', triste: 'triste', debil: 'débil' };
  const COLOR_DEBIL = '#8E9884';

  /**
   * @param {object} o { etapa, estado, color: {cuerpo, triste}, tamanio, grietas (0-3, solo huevo) }
   * @returns {string} SVG
   */
  function dibujarMascota(o) {
    const etapa = o.etapa || 'joven';
    const estado = o.estado || 'tranquilo';
    const tam = o.tamanio || 96;
    const colorCuerpo = estado === 'debil' ? COLOR_DEBIL : (estado === 'triste' ? o.color.triste : o.color.cuerpo);
    let contenido = rects(CUERPOS[etapa], colorCuerpo);
    if (etapa === 'huevo') contenido += rects(GRIETAS[Math.max(0, Math.min(3, o.grietas || 0))], GRIETA);
    else contenido += rects(CARAS[estado], OSCURO, ALTURA_CARA[etapa]);
    const alt = etapa === 'huevo' ? 'Mascota: todavía es un huevo' : 'Mascota ' + NOMBRE_ESTADO[estado];
    return svg(contenido, tam, alt);
  }

  /**
   * Escena de nacimiento: el huevo tiembla, se parte en dos y sale el bebé.
   * El estado final (bebé visible) es el estilo base; la animación solo lo recorre,
   * así con las animaciones apagadas se ve directamente el resultado.
   */
  function escenaNacimiento(color, tam) {
    const huevo = rects(CUERPOS.huevo, '#EDE6D3') + rects(GRIETAS[3], GRIETA);
    return '<div class="escena-nacimiento" style="width:' + tam + 'px;height:' + tam + 'px">' +
      '<div class="nac-huevo">' + svg(huevo, tam) + '</div>' +
      '<div class="nac-mitad arriba">' + svg(huevo, tam) + '</div>' +
      '<div class="nac-mitad abajo">' + svg(huevo, tam) + '</div>' +
      '<div class="nac-bebe">' + dibujarMascota({ etapa: 'bebe', estado: 'feliz', color, tamanio: tam }) + '</div>' +
      '<span class="chispas nac-chispas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      '</div>';
  }

  AQ.dibujarMascota = dibujarMascota;
  AQ.escenaNacimiento = escenaNacimiento;
})(globalThis.AQ = globalThis.AQ || {});
