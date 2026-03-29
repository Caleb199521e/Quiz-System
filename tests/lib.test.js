const lib = require('../js/lib.js');

describe('lib utilities', ()=>{
    test('escapeHtml should escape special chars', ()=>{
        expect(lib.escapeHtml('<div>&</div>')).toBe('&lt;div&gt;&amp;&lt;/div&gt;');
    });

    test('batchParse should parse pipe-separated lines', ()=>{
        const txt = 'Biology 101 | What is 2+2? | 1 | 2 | 4 | 3 | C\nBad line | missing fields';
        const out = lib.batchParse(txt);
        expect(Array.isArray(out)).toBe(true);
        expect(out.length).toBe(1);
        expect(out[0].courseName).toBe('Biology 101');
        expect(out[0].text).toBe('What is 2+2?');
        expect(out[0].options[2]).toBe('4');
        expect(out[0].correctLetter).toBe('C');
    });

    test('batchParse should parse comma-separated lines', ()=>{
        const txt = 'Geography,Capital of France?,Berlin,Madrid,Paris,Lisbon,C';
        const out = lib.batchParse(txt);
        expect(out.length).toBe(1);
        expect(out[0].courseName).toBe('Geography');
        expect(out[0].options[2]).toBe('Paris');
    });

    test('batchParse should support legacy 6-column format', ()=>{
        const txt = 'Capital of Ghana?,Accra,Kumasi,Tamale,Wa,A';
        const out = lib.batchParse(txt);
        expect(out.length).toBe(1);
        expect(out[0].courseName).toBe('General');
    });
});
