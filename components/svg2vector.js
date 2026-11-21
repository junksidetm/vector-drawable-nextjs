/**
 * svg2vector.js
 * Client-side SVG to Android VectorDrawable (<vector>) converter.
 * Fully autonomous, pure JS, operates in the browser via DOMParser.
 */

const NAMED_COLORS = {
    white: '#FFFFFF',
    black: '#000000',
    red: '#FF0000',
    green: '#008000',
    blue: '#0000FF',
    yellow: '#FFFF00',
    cyan: '#00FFFF',
    magenta: '#FF00FF',
    gray: '#808080',
    grey: '#808080',
    lightgray: '#D3D3D3',
    lightgrey: '#D3D3D3',
    darkgray: '#A9A9A9',
    darkgrey: '#A9A9A9',
    transparent: '#00000000',
};

function normalizeColor(color) {
    if (!color || typeof color !== 'string') return null;
    const clean = color.trim().toLowerCase();
    if (clean === 'none' || clean === 'transparent') return null;

    if (NAMED_COLORS[clean]) {
        return NAMED_COLORS[clean];
    }

    // #RGB or #RGBA
    if (clean.startsWith('#')) {
        const hex = clean.slice(1);
        if (hex.length === 3) {
            return '#' + hex.split('').map(c => c + c).join('').toUpperCase();
        }
        if (hex.length === 4) {
            // #RGBA -> #AARRGGBB
            const r = hex[0] + hex[0];
            const g = hex[1] + hex[1];
            const b = hex[2] + hex[2];
            const a = hex[3] + hex[3];
            return ('#' + a + r + g + b).toUpperCase();
        }
        if (hex.length === 6) {
            return ('#' + hex).toUpperCase();
        }
        if (hex.length === 8) {
            // #RRGGBBAA -> #AARRGGBB
            const rr = hex.slice(0, 2);
            const gg = hex.slice(2, 4);
            const bb = hex.slice(4, 6);
            const aa = hex.slice(6, 8);
            return ('#' + aa + rr + gg + bb).toUpperCase();
        }
        return ('#' + hex).toUpperCase();
    }

    // rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = clean.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
        if (rgbMatch[4] !== undefined) {
            const alphaVal = Math.round(parseFloat(rgbMatch[4]) * 255);
            const a = alphaVal.toString(16).padStart(2, '0');
            return ('#' + a + r + g + b).toUpperCase();
        }
        return ('#' + r + g + b).toUpperCase();
    }

    return color;
}

function parsePoints(pointsStr) {
    if (!pointsStr) return [];
    return pointsStr
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter(n => !isNaN(n));
}

function rectToPath(x, y, w, h, rx, ry) {
    if (rx > 0 || ry > 0) {
        rx = rx || ry;
        ry = ry || rx;
        rx = Math.min(rx, w / 2);
        ry = Math.min(ry, h / 2);
        return `M${x + rx},${y} h${w - 2 * rx} a${rx},${ry} 0 0,1 ${rx},${ry} v${h - 2 * ry} a${rx},${ry} 0 0,1 -${rx},${ry} h-${w - 2 * rx} a${rx},${ry} 0 0,1 -${rx},-${ry} v-${h - 2 * ry} a${rx},${ry} 0 0,1 ${rx},-${ry} z`;
    }
    return `M${x},${y} h${w} v${h} h-${w} z`;
}

function circleToPath(cx, cy, r) {
    return `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 -${2 * r},0 z`;
}

function ellipseToPath(cx, cy, rx, ry) {
    return `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${2 * rx},0 a${rx},${ry} 0 1,0 -${2 * rx},0 z`;
}

function lineToPath(x1, y1, x2, y2) {
    return `M${x1},${y1} L${x2},${y2}`;
}

function pointsToPath(points, close = false) {
    if (points.length < 2) return '';
    let d = `M${points[0]},${points[1]}`;
    for (let i = 2; i < points.length; i += 2) {
        d += ` L${points[i]},${points[i + 1]}`;
    }
    if (close) d += ' z';
    return d;
}

function parseTransforms(transformStr) {
    const res = {};
    if (!transformStr) return res;

    const translate = /translate\(\s*([\d.-]+)(?:[\s,]+([\d.-]+))?\s*\)/i.exec(transformStr);
    if (translate) {
        res.translateX = parseFloat(translate[1]);
        if (translate[2] !== undefined) {
            res.translateY = parseFloat(translate[2]);
        }
    }

    const scale = /scale\(\s*([\d.-]+)(?:[\s,]+([\d.-]+))?\s*\)/i.exec(transformStr);
    if (scale) {
        res.scaleX = parseFloat(scale[1]);
        res.scaleY = scale[2] !== undefined ? parseFloat(scale[2]) : res.scaleX;
    }

    const rotate = /rotate\(\s*([\d.-]+)(?:[\s,]+([\d.-]+)[\s,]+([\d.-]+))?\s*\)/i.exec(transformStr);
    if (rotate) {
        res.rotation = parseFloat(rotate[1]);
        if (rotate[2] !== undefined && rotate[3] !== undefined) {
            res.pivotX = parseFloat(rotate[2]);
            res.pivotY = parseFloat(rotate[3]);
        }
    }

    return res;
}

function processElement(element, inherited = {}, indent = '    ') {
    const tagName = element.tagName.toLowerCase();
    const lines = [];

    // Skip non-graphical tags
    if (['defs', 'clippath', 'mask', 'filter', 'style', 'title', 'desc', 'metadata'].includes(tagName)) {
        return '';
    }

    // Merge styles
    const fillAttr = element.getAttribute('fill') || inherited.fill;
    const strokeAttr = element.getAttribute('stroke') || inherited.stroke;
    const strokeWidthAttr = element.getAttribute('stroke-width') || inherited.strokeWidth;
    const opacityAttr = element.getAttribute('opacity');
    const fillOpacityAttr = element.getAttribute('fill-opacity');
    const strokeOpacityAttr = element.getAttribute('stroke-opacity');
    const fillRuleAttr = element.getAttribute('fill-rule') || element.getAttribute('clip-rule');
    const strokeLineCapAttr = element.getAttribute('stroke-linecap');
    const strokeLineJoinAttr = element.getAttribute('stroke-linejoin');

    if (tagName === 'g') {
        const groupTransforms = parseTransforms(element.getAttribute('transform'));
        const groupAttrs = [];

        if (element.id) {
            groupAttrs.push(`android:name="${element.id}"`);
        }
        if (groupTransforms.translateX !== undefined) groupAttrs.push(`android:translateX="${groupTransforms.translateX}"`);
        if (groupTransforms.translateY !== undefined) groupAttrs.push(`android:translateY="${groupTransforms.translateY}"`);
        if (groupTransforms.scaleX !== undefined) groupAttrs.push(`android:scaleX="${groupTransforms.scaleX}"`);
        if (groupTransforms.scaleY !== undefined) groupAttrs.push(`android:scaleY="${groupTransforms.scaleY}"`);
        if (groupTransforms.rotation !== undefined) groupAttrs.push(`android:rotation="${groupTransforms.rotation}"`);
        if (groupTransforms.pivotX !== undefined) groupAttrs.push(`android:pivotX="${groupTransforms.pivotX}"`);
        if (groupTransforms.pivotY !== undefined) groupAttrs.push(`android:pivotY="${groupTransforms.pivotY}"`);
        if (opacityAttr) groupAttrs.push(`android:alpha="${opacityAttr}"`);

        const nextInherited = {
            fill: fillAttr,
            stroke: strokeAttr,
            strokeWidth: strokeWidthAttr,
        };

        const childrenXml = [];
        for (let i = 0; i < element.children.length; i++) {
            const childXml = processElement(element.children[i], nextInherited, indent + '    ');
            if (childXml) childrenXml.push(childXml);
        }

        if (childrenXml.length === 0) return '';

        if (groupAttrs.length > 0) {
            return `${indent}<group\n${indent}    ${groupAttrs.join('\n' + indent + '    ')}>\n${childrenXml.join('\n')}\n${indent}</group>`;
        }
        return childrenXml.join('\n');
    }

    // Extract Path Data
    let pathData = '';
    if (tagName === 'path') {
        pathData = element.getAttribute('d') || '';
    } else if (tagName === 'rect') {
        const x = parseFloat(element.getAttribute('x') || 0);
        const y = parseFloat(element.getAttribute('y') || 0);
        const w = parseFloat(element.getAttribute('width') || 0);
        const h = parseFloat(element.getAttribute('height') || 0);
        const rx = parseFloat(element.getAttribute('rx') || 0);
        const ry = parseFloat(element.getAttribute('ry') || 0);
        if (w > 0 && h > 0) {
            pathData = rectToPath(x, y, w, h, rx, ry);
        }
    } else if (tagName === 'circle') {
        const cx = parseFloat(element.getAttribute('cx') || 0);
        const cy = parseFloat(element.getAttribute('cy') || 0);
        const r = parseFloat(element.getAttribute('r') || 0);
        if (r > 0) {
            pathData = circleToPath(cx, cy, r);
        }
    } else if (tagName === 'ellipse') {
        const cx = parseFloat(element.getAttribute('cx') || 0);
        const cy = parseFloat(element.getAttribute('cy') || 0);
        const rx = parseFloat(element.getAttribute('rx') || 0);
        const ry = parseFloat(element.getAttribute('ry') || 0);
        if (rx > 0 && ry > 0) {
            pathData = ellipseToPath(cx, cy, rx, ry);
        }
    } else if (tagName === 'line') {
        const x1 = parseFloat(element.getAttribute('x1') || 0);
        const y1 = parseFloat(element.getAttribute('y1') || 0);
        const x2 = parseFloat(element.getAttribute('x2') || 0);
        const y2 = parseFloat(element.getAttribute('y2') || 0);
        pathData = lineToPath(x1, y1, x2, y2);
    } else if (tagName === 'polyline') {
        const points = parsePoints(element.getAttribute('points'));
        pathData = pointsToPath(points, false);
    } else if (tagName === 'polygon') {
        const points = parsePoints(element.getAttribute('points'));
        pathData = pointsToPath(points, true);
    }

    if (!pathData || !pathData.trim()) return '';

    // Clean whitespace inside pathData
    pathData = pathData.replace(/\s+/g, ' ').trim();

    const pathAttrs = [];
    if (element.id) {
        pathAttrs.push(`android:name="${element.id}"`);
    }

    // Color resolution
    const normalizedFill = normalizeColor(fillAttr);
    const normalizedStroke = normalizeColor(strokeAttr);

    if (normalizedFill) {
        pathAttrs.push(`android:fillColor="${normalizedFill}"`);
    } else if (fillAttr === 'none') {
        // Explicitly none
    } else if (!strokeAttr || strokeAttr === 'none') {
        // Default SVG fill is black if neither fill nor stroke are specified
        pathAttrs.push(`android:fillColor="#FF000000"`);
    }

    if (fillOpacityAttr) {
        pathAttrs.push(`android:fillAlpha="${fillOpacityAttr}"`);
    }

    if (fillRuleAttr && fillRuleAttr.toLowerCase() === 'evenodd') {
        pathAttrs.push(`android:fillType="evenOdd"` );
    }

    if (normalizedStroke) {
        pathAttrs.push(`android:strokeColor="${normalizedStroke}"`);
        const strokeW = strokeWidthAttr ? parseFloat(strokeWidthAttr) : 1;
        pathAttrs.push(`android:strokeWidth="${strokeW}"`);
        if (strokeOpacityAttr) {
            pathAttrs.push(`android:strokeAlpha="${strokeOpacityAttr}"`);
        }
        if (strokeLineCapAttr) {
            pathAttrs.push(`android:strokeLineCap="${strokeLineCapAttr}"`);
        }
        if (strokeLineJoinAttr) {
            pathAttrs.push(`android:strokeLineJoin="${strokeLineJoinAttr}"`);
        }
    }

    pathAttrs.push(`android:pathData="${pathData}"`);

    // Check if element has transform
    const elementTransform = parseTransforms(element.getAttribute('transform'));
    const hasTransform = Object.keys(elementTransform).length > 0;

    let pathXml = `${indent}<path\n${indent}    ${pathAttrs.join('\n' + indent + '    ')} />`;

    if (hasTransform) {
        const groupAttrs = [];
        if (elementTransform.translateX !== undefined) groupAttrs.push(`android:translateX="${elementTransform.translateX}"`);
        if (elementTransform.translateY !== undefined) groupAttrs.push(`android:translateY="${elementTransform.translateY}"`);
        if (elementTransform.scaleX !== undefined) groupAttrs.push(`android:scaleX="${elementTransform.scaleX}"`);
        if (elementTransform.scaleY !== undefined) groupAttrs.push(`android:scaleY="${elementTransform.scaleY}"`);
        if (elementTransform.rotation !== undefined) groupAttrs.push(`android:rotation="${elementTransform.rotation}"`);
        if (elementTransform.pivotX !== undefined) groupAttrs.push(`android:pivotX="${elementTransform.pivotX}"`);
        if (elementTransform.pivotY !== undefined) groupAttrs.push(`android:pivotY="${elementTransform.pivotY}"`);

        return `${indent}<group\n${indent}    ${groupAttrs.join('\n' + indent + '    ')}>\n${indent}    ${pathXml.trim()}\n${indent}</group>`;
    }

    return pathXml;
}

/**
 * Converts any SVG code into clean, production-ready Android VectorDrawable XML.
 * @param {string} svgString - The raw SVG markup.
 * @returns {string} The converted Android <vector> XML string.
 */
export function svgToVectorDrawable(svgString) {
    if (!svgString || typeof svgString !== 'string' || !svgString.trim()) {
        throw new Error('Empty or invalid SVG input provided.');
    }

    if (typeof window === 'undefined') {
        throw new Error('SVG conversion requires browser environment.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        throw new Error('SVG parsing failed: ' + parserError.textContent.slice(0, 100));
    }

    const svg = doc.querySelector('svg');
    if (!svg) {
        throw new Error('No root <svg> element found in the input.');
    }

    // Determine dimensions
    let width = 24;
    let height = 24;
    let viewportWidth = 24;
    let viewportHeight = 24;

    const viewBoxAttr = svg.getAttribute('viewBox');
    if (viewBoxAttr) {
        const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            viewportWidth = parts[2];
            viewportHeight = parts[3];
            width = parts[2];
            height = parts[3];
        }
    }

    const widthAttr = svg.getAttribute('width');
    const heightAttr = svg.getAttribute('height');
    if (widthAttr) {
        const w = parseFloat(widthAttr);
        if (!isNaN(w) && w > 0) width = w;
    }
    if (heightAttr) {
        const h = parseFloat(heightAttr);
        if (!isNaN(h) && h > 0) height = h;
    }

    if (!viewBoxAttr) {
        viewportWidth = width;
        viewportHeight = height;
    }

    // Parse all root child nodes
    const childrenXml = [];
    for (let i = 0; i < svg.children.length; i++) {
        const childXml = processElement(svg.children[i]);
        if (childXml) childrenXml.push(childXml);
    }

    if (childrenXml.length === 0) {
        throw new Error('No drawable path or shape elements found inside the SVG.');
    }

    const vectorXml = [
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        `    android:width="${width}dp"`,
        `    android:height="${height}dp"`,
        `    android:viewportWidth="${viewportWidth}"`,
        `    android:viewportHeight="${viewportHeight}">`,
        childrenXml.join('\n'),
        '</vector>'
    ].join('\n');

    return vectorXml;
}
