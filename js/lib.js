(function(exports){
    // Pure utilities used by both browser UI and node tests
    function escapeHtml(str){
        if(str === null || str === undefined) return '';
        if(typeof str !== 'string') str = String(str);
        return str.replace(/[&<>]/g, function(m){ if(m === '&') return '&amp;'; if(m === '<') return '&lt;'; if(m === '>') return '&gt;'; return m; });
    }

    // Accepts batch content that may be pipe-separated or comma-separated.
    // Supports:
    //  - 8 columns: CourseName | Topic | Question | A | B | C | D | CorrectLetter
    //  - 7 columns: CourseName | Question | A | B | C | D | CorrectLetter (topic defaults to "General")
    //  - 6 columns: Question | A | B | C | D | CorrectLetter (course defaults to "General", topic defaults to "General")
    // Returns: { courseName, topic, text, options:[A,B,C,D], correctLetter }
    function batchParse(content){
        if(!content || typeof content !== 'string') return [];
        const lines = content.split(/\r?\n/);
        const out = [];
        for(let raw of lines){
            let line = raw.trim();
            if(line === '') continue;
            // prefer pipe (|) delimiter, else fall back to comma
            let parts = null;
            if(line.indexOf('|') !== -1) parts = line.split('|').map(p => p.trim());
            else parts = line.split(',').map(p => p.trim());
            if(parts.length < 6) continue; // need at least 6 columns
            let courseName = 'General';
            let topic = 'General';
            let question, optA, optB, optC, optD, correct;
            if(parts.length >= 8){
                [courseName, topic, question, optA, optB, optC, optD, correct] = parts;
            } else if(parts.length === 7){
                [courseName, question, optA, optB, optC, optD, correct] = parts;
            } else {
                [question, optA, optB, optC, optD, correct] = parts;
            }
            if(!question || !optA || !optB || !optC || !optD) continue;
            const corrUp = (correct || '').toString().trim().toUpperCase();
            if(!['A','B','C','D'].includes(corrUp)) continue;
            out.push({ courseName: (courseName || 'General').toString().trim() || 'General', topic: (topic || 'General').toString().trim() || 'General', text: question, options: [optA, optB, optC, optD], correctLetter: corrUp });
        }
        return out;
    }

    exports.escapeHtml = escapeHtml;
    exports.batchParse = batchParse;

    // Node.js exports
    if(typeof module !== 'undefined' && module.exports) module.exports = exports;
    // Browser-friendly attach
    if(typeof window !== 'undefined'){
        window.escapeHtml = escapeHtml;
        window.batchParse = batchParse;
    }
})(typeof exports === 'undefined' ? {} : exports);
