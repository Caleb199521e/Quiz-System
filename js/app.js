// DOM and UI logic for the quiz app. Depends on `batchParse` and `escapeHtml` from lib.js
(function(){
    // ---------- GLOBAL DATA ----------
    let questionsBank = [];       // each: { text, options: [A,B,C,D], correctLetter }
    let currentRole = null;      // 'staff' or 'student'
    let isStaffPreviewMode = false; // flag to track if staff is previewing quiz (not taking it)
    
    // Student state
    let studentAnswers = [];      // array of { selectedLetter, isCorrect }
    let currentQIndex = 0;
    let quizActive = false;       // are we currently taking quiz (not on results)
    let quizQuestions = [];        // snapshot of questions when quiz starts
    let selectedCourse = null;
    let selectedTopic = null;     // NEW: topic selection
    let staffSelectedCourse = '';
    let coursesBank = [];

    // Config: optional API base and Supabase client (set window.API_BASE / SUPABASE_URL / SUPABASE_ANON_KEY in HTML)
    const API_BASE = window.API_BASE || '';
    const SUPABASE_URL = window.SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
    const STORAGE_KEY = 'ecorevise_questions_v1';
    const COURSES_STORAGE_KEY = 'ecorevise_courses_v1';

    // Supabase client can be initialized lazily in case module loading is delayed.
    let supabaseClient = null;
    function getSupabaseClient(){
        if(supabaseClient) return supabaseClient;
        const createClientFactory = window.createSupabaseClient;
        const url = window.SUPABASE_URL || SUPABASE_URL;
        const anonKey = window.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
        if(typeof createClientFactory === 'function' && url && anonKey){
            supabaseClient = createClientFactory(url, anonKey);
            return supabaseClient;
        }
        return null;
    }

    function persistQuestions() {
        try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(questionsBank)); } catch(e){ console.warn('Could not persist questions', e); }
    }

    function persistCourses(){
        try{ localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(coursesBank)); } catch(e){ console.warn('Could not persist courses', e); }
    }

    const QUIZ_SESSION_KEY = 'ecorevise_quiz_session_v1';
    
    // Save quiz progress to session storage so student can resume if page refreshes
    function saveQuizProgress() {
        try {
            const quizSession = {
                quizActive,
                currentQIndex,
                studentAnswers,
                quizQuestions: quizQuestions.map(q => ({ 
                    text: q.text, 
                    options: q.options, 
                    correctLetter: q.correctLetter, 
                    courseName: q.courseName, 
                    topic: q.topic 
                })),
                selectedCourse,
                selectedTopic,
                quizStartTime: window.quizStartTime
            };
            sessionStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify(quizSession));
        } catch(e) {
            console.warn('Could not save quiz progress', e);
        }
    }
    
    // Restore quiz progress from session storage if available
    function restoreQuizProgress() {
        try {
            const saved = sessionStorage.getItem(QUIZ_SESSION_KEY);
            if (saved) {
                const session = JSON.parse(saved);
                if (session.quizActive && session.quizQuestions && session.quizQuestions.length > 0) {
                    quizQuestions = session.quizQuestions;
                    studentAnswers = session.studentAnswers || new Array(quizQuestions.length).fill(null);
                    currentQIndex = session.currentQIndex || 0;
                    selectedCourse = session.selectedCourse;
                    selectedTopic = session.selectedTopic;
                    window.quizStartTime = session.quizStartTime || Date.now();
                    quizActive = true;
                    return true;
                }
            }
        } catch(e) {
            console.warn('Could not restore quiz progress', e);
        }
        return false;
    }
    
    // Clear saved quiz progress
    function clearQuizProgress() {
        try {
            sessionStorage.removeItem(QUIZ_SESSION_KEY);
        } catch(e) {
            console.warn('Could not clear quiz progress', e);
        }
    }

    function normalizeCourseName(courseName){
        const value = (courseName || '').toString().trim();
        // Normalize multiple spaces to single space
        const normalized = value.replace(/\s+/g, ' ');
        return normalized || 'General';
    }

    function cleanupDuplicateCourses(){
        // Remove duplicate UGBS104 entries with General topic from questions
        const beforeCount = questionsBank.length;
        questionsBank = questionsBank.filter(q => {
            // Remove UGBS104 questions with General topic (keep only one set)
            if(normalizeCourseName(q.courseName) === 'UGBS104' && (q.topic === 'General' || !q.topic)){
                return false; // Remove this one
            }
            return true;
        });
        if(questionsBank.length < beforeCount){
            persistQuestions();
            showToast(`Removed ${beforeCount - questionsBank.length} duplicate UGBS104 General questions`, 'green');
        }
        
        // Deduplicate coursesBank - normalize all entries and remove duplicates
        if(Array.isArray(coursesBank) && coursesBank.length > 0){
            const uniqueCourses = Array.from(new Set(coursesBank.map(c => normalizeCourseName(c))));
            if(uniqueCourses.length < coursesBank.length){
                coursesBank = uniqueCourses;
                persistCourses();
            }
        }
    }

    function getAvailableCourses(){
        if(Array.isArray(coursesBank) && coursesBank.length > 0){
            return Array.from(new Set(coursesBank.map(normalizeCourseName))).sort((first, second) => first.localeCompare(second));
        }
        const uniq = new Set();
        for(const q of questionsBank){ uniq.add(normalizeCourseName(q.courseName)); }
        return Array.from(uniq).sort((first, second) => first.localeCompare(second));
    }

    function ensureCourseInLocalBank(courseName){
        const normalized = normalizeCourseName(courseName);
        if(!coursesBank.includes(normalized)){
            coursesBank.push(normalized);
            persistCourses();
        }
        return normalized;
    }

    async function loadCourses(){
        if(API_BASE){
            try{
                const token = await getAccessToken();
                const res = await fetch(`${API_BASE}/api/courses`, { headers: token ? { 'Authorization': 'Bearer ' + token } : {} });
                if(res.ok){
                    const data = await res.json();
                    coursesBank = (data || []).map(course => normalizeCourseName(course.name));
                    persistCourses();
                    return;
                }
            } catch(e){ console.warn('Error fetching courses from API', e); }
        }
        const stored = localStorage.getItem(COURSES_STORAGE_KEY);
        if(stored){
            try{ coursesBank = JSON.parse(stored); if(!Array.isArray(coursesBank)) coursesBank = []; } catch(e){ coursesBank = []; }
        }
    }

    async function createCourse(courseName, options = {}){
        const normalized = normalizeCourseName(courseName);
        // Check if course already exists - only create if new
        const courseExists = getAvailableCourses().includes(normalized);
        if(courseExists && options.silent){
            // Silent mode and course exists: just return it without re-creating
            return normalized;
        }
        if(API_BASE){
            try{
                const token = await getAccessToken();
                const res = await fetch(`${API_BASE}/api/courses`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {}),
                    body: JSON.stringify({ name: normalized })
                });
                if(!res.ok){
                    if(!options.silent) showToast('Failed to create course on server', 'red');
                    return null;
                }
            } catch(e){
                if(!options.silent) showToast('Error creating course', 'red');
                return null;
            }
        }
        ensureCourseInLocalBank(normalized);
        if(!options.silent && !courseExists) showToast(`Course saved: ${normalized}`, 'green');
        renderStaffCourseChips();
        return normalized;
    }

    function renderStaffCourseChips(){
        const chipList = document.getElementById('courseChipList');
        const courseInput = document.getElementById('singleCourseName');
        if(!chipList || !courseInput) return;

        const currentValue = normalizeCourseName(courseInput.value);
        const courses = getAvailableCourses();
        const chipsHtml = [
            `<button type="button" data-course="__NEW__" class="course-chip px-3 py-1 rounded-xl text-xs border border-gray-300 bg-white hover:bg-gray-100"><span class="material-symbols-outlined mi">add</span>Create New Course</button>`,
            ...courses.map((courseName) => {
                const activeClass = currentValue === courseName ? 'bg-green-700 text-white border-green-700' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
                const isGeneral = courseName === 'General';
                const deleteBtn = !isGeneral ? `<button type="button" class="course-delete-btn material-symbols-outlined mi text-inherit hover:opacity-100 opacity-70 transition" data-course="${escapeHtml(courseName)}" title="Delete course and all its questions" style="font-size: 0.875rem; background: none; border: none; cursor: pointer; padding: 0; margin-left: 0.25rem;">close</button>` : '';
                return `<div class="inline-flex items-center gap-1"><button type="button" data-course="${escapeHtml(courseName)}" class="course-chip px-3 py-2 rounded-xl text-xs border shadow-sm ${activeClass}"><span class="material-symbols-outlined mi">school</span>${escapeHtml(courseName)}</button>${deleteBtn}</div>`;
            })
        ];

        chipList.innerHTML = chipsHtml.join('');
        
        // Course selection handlers
        chipList.querySelectorAll('.course-chip').forEach((chip) => {
            chip.addEventListener('click', async () => {
                const selected = chip.getAttribute('data-course');
                if(selected === '__NEW__'){
                    const candidate = normalizeCourseName(courseInput.value);
                    if(candidate && candidate !== 'General'){
                        const created = await createCourse(candidate, { silent: false });
                        if(created) courseInput.value = created;
                    } else {
                        courseInput.value = '';
                        courseInput.focus();
                    }
                } else {
                    courseInput.value = selected || '';
                }
                renderStaffCourseChips();
                renderStaffTopicChips();
            });
        });
        
        // Course delete handlers
        chipList.querySelectorAll('.course-delete-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const courseName = btn.getAttribute('data-course');
                deleteCourse(courseName);
            });
        });
    }

    async function deleteCourse(courseName) {
        if(confirm(`Delete course "${courseName}" and ALL its questions? This cannot be undone.`)) {
            try {
                if(API_BASE) {
                    const token = await getAccessToken();
                    const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseName)}`, {
                        method: 'DELETE',
                        headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {})
                    });
                    if(res.ok) {
                        await loadCourses();
                        await loadQuestionsFromStorage();
                        createToast(`Course "${courseName}" deleted successfully`, 'success');
                    } else {
                        const error = await res.json();
                        createToast(error.error || 'Failed to delete course', 'error');
                    }
                } else {
                    // Local deletion only
                    questionsBank = questionsBank.filter(q => normalizeCourseName(q.courseName) !== courseName);
                    const idx = coursesBank.indexOf(courseName);
                    if(idx >= 0) coursesBank.splice(idx, 1);
                    persistQuestions();
                    persistCourses();
                    updateStaffListUI();
                    createToast(`Course "${courseName}" deleted successfully`, 'success');
                }
            } catch(e) {
                console.error('Delete course error:', e);
                createToast('Error deleting course: ' + e.message, 'error');
            }
        }
    }

    function renderStaffTopicChips(){
        const chipList = document.getElementById('topicChipList');
        const topicInput = document.getElementById('singleTopicName');
        if(!chipList || !topicInput) return;

        const currentValue = (topicInput.value || '').trim() || '';
        // Get unique topics from current course's questions
        const courseInput = document.getElementById('singleCourseName');
        const selectedCourse = normalizeCourseName(courseInput?.value);
        
        const topicsInCourse = Array.from(new Set(
            questionsBank
                .filter(q => !selectedCourse || normalizeCourseName(q.courseName) === selectedCourse)
                .map(q => (q.topic || 'General'))
        )).sort();

        const chipsHtml = topicsInCourse.map((topic) => {
            const activeClass = currentValue === topic ? 'bg-purple-700 text-white border-purple-700' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100';
            return `<button type="button" data-topic="${escapeHtml(topic)}" class="topic-chip px-3 py-2 rounded-xl text-xs border shadow-sm ${activeClass}"><span class="material-symbols-outlined mi">label</span>${escapeHtml(topic)}</button>`;
        });

        chipList.innerHTML = chipsHtml.join('');
        chipList.querySelectorAll('.topic-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                const selected = chip.getAttribute('data-topic');
                topicInput.value = selected || '';
                renderStaffTopicChips();
            });
        });
    }

    async function getAccessToken(){
        const client = getSupabaseClient();
        if(!client) return null;
        try{
            const s = await client.auth.getSession();
            return s?.data?.session?.access_token || null;
        } catch(e){ return null; }
    }

    function createToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Icon mapping for different toast types
        const icons = {
            'success': 'check_circle',
            'error': 'error',
            'warning': 'warning',
            'info': 'info',
            'amber': 'info'
        };

        const icon = icons[type] || 'info';
        
        toast.innerHTML = `
            <span class="toast-icon material-symbols-outlined">${icon}</span>
            <div class="toast-content">${escapeHtml(message)}</div>
            <button class="toast-close material-symbols-outlined" title="Close">close</button>
        `;

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        });

        container.appendChild(toast);

        // Auto-remove after duration
        const timeoutId = setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);

        // Store timeout so it can be cleared if manually closed
        toast.timeoutId = timeoutId;

        return toast;
    }

    function showToast(msg, type = 'green') {
        // Map old color codes to new type names
        const typeMap = {
            'green': 'success',
            'red': 'error',
            'amber': 'warning'
        };
        const toastType = typeMap[type] || 'info';
        createToast(msg, toastType);
    }

    function showAuthToast(msg, type = 'green') {
        // Map old color codes to new type names
        const typeMap = {
            'green': 'success',
            'red': 'error',
            'amber': 'warning'
        };
        const toastType = typeMap[type] || 'info';
        createToast(msg, toastType, 4000);
    }

    function showBatchToast(msg) {
        createToast(msg, 'success', 3500);
    }

    // Load questions either from server (if API_BASE configured) or from localStorage
    async function loadQuestionsFromStorage() {
        if(API_BASE){
            try{
                // First, run cleanup if connected to API
                try {
                    const token = await getAccessToken();
                    if(token){
                        await fetch(`${API_BASE}/api/cleanup-courses`, {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
                        }).catch(e => console.warn('Cleanup failed (non-critical)', e));
                    }
                } catch(e){ /* Cleanup is non-critical */ }
                
                const token = await getAccessToken();
                const res = await fetch(`${API_BASE}/api/questions`, { headers: token ? { 'Authorization': 'Bearer ' + token } : {} });
                if(res.ok){
                    const data = await res.json();
                    // map server fields to local shape
                    questionsBank = (data || []).map(d => ({ id: d.id, courseName: normalizeCourseName(d.course_name), text: d.text, options: d.options, correctLetter: d.correct_letter, inserted_at: d.inserted_at }));
                    updateStaffListUI();
                    return;
                } else {
                    console.warn('Failed to fetch from API, falling back to localStorage');
                }
            } catch(e){ console.warn('Error fetching questions from API', e); }
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        if(stored) {
            try{ questionsBank = JSON.parse(stored); if(!Array.isArray(questionsBank)) questionsBank = []; } catch(e){ questionsBank = []; }
        } else {
            // Add some demo questions for starter
            questionsBank = [
                { courseName: "Biology", text: "What is the powerhouse of the cell?", options: ["Nucleus", "Mitochondria", "Ribosome", "Chloroplast"], correctLetter: "B" },
                { courseName: "Environmental Science", text: "Which of the following is a greenhouse gas?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correctLetter: "C" }
            ];
            persistQuestions();
        }
        questionsBank = questionsBank.map(q => ({ ...q, courseName: normalizeCourseName(q.courseName) }));
        for(const q of questionsBank){ ensureCourseInLocalBank(q.courseName); }
        cleanupDuplicateCourses();
        updateStaffListUI();
    }

    // Filtering and sorting state
    let staffSearchQuery = '';
    let staffSortBy = 'date';

    function applyFilters() {
        // Start with all questions
        let filtered = [...questionsBank];
        
        // Apply course filter
        if(staffSelectedCourse) {
            filtered = filtered.filter(q => normalizeCourseName(q.courseName) === staffSelectedCourse);
        }
        
        // Apply topic filter
        const staffTopicFilter = document.getElementById('staffTopicFilter');
        const staffSelectedTopic = staffTopicFilter?.value;
        if(staffSelectedTopic) {
            filtered = filtered.filter(q => (q.topic || 'General') === staffSelectedTopic);
        }
        
        // Apply search filter
        if(staffSearchQuery.trim()) {
            const query = staffSearchQuery.toLowerCase();
            filtered = filtered.filter(q => {
                const text = q.text.toLowerCase();
                const options = q.options.map(o => o.toLowerCase()).join(' ');
                const topic = (q.topic || 'General').toLowerCase();
                const course = normalizeCourseName(q.courseName).toLowerCase();
                return text.includes(query) || options.includes(query) || topic.includes(query) || course.includes(query);
            });
        }
        
        // Apply sorting
        switch(staffSortBy) {
            case 'date':
                filtered.sort((a, b) => {
                    const dateA = new Date(a.inserted_at || 0);
                    const dateB = new Date(b.inserted_at || 0);
                    return dateB - dateA; // newest first
                });
                break;
            case 'course':
                filtered.sort((a, b) => normalizeCourseName(a.courseName).localeCompare(normalizeCourseName(b.courseName)));
                break;
            case 'topic':
                filtered.sort((a, b) => (a.topic || 'General').localeCompare(b.topic || 'General'));
                break;
            case 'text':
                filtered.sort((a, b) => a.text.localeCompare(b.text));
                break;
        }
        
        return filtered;
    }

    function updateQuestionDisplay() {
        const container = document.getElementById('questionListContainer');
        const countSpan = document.getElementById('questionCountInfo');
        if(!container) return;

        const filteredQuestions = applyFilters();
        const staffCourseFilter = document.getElementById('staffCourseFilter');
        const staffTopicFilter = document.getElementById('staffTopicFilter');
        const staffSelectedTopic = staffTopicFilter?.value;
        
        // Update clear filters button visibility
        const clearBtn = document.getElementById('clearFiltersBtn');
        if(clearBtn) {
            const hasFilters = staffSelectedCourse || staffSelectedTopic || staffSearchQuery.trim();
            clearBtn.classList.toggle('hidden', !hasFilters);
        }

        if(filteredQuestions.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-400 py-8">No questions match the filters. Add some above.</div>`;
            if(countSpan) {
                let label = 'questions available';
                if(staffSelectedCourse) label = `questions in ${staffSelectedCourse}`;
                if(staffSelectedTopic) label = `questions in ${staffSelectedCourse}/${staffSelectedTopic}`;
                if(staffSearchQuery.trim()) label += ` matching "${staffSearchQuery}"`;
                countSpan.innerText = `0 ${label}`;
            }
            return;
        }
        
        if(countSpan) {
            let label = 'question(s) available';
            if(staffSelectedCourse) label = `question(s) in ${staffSelectedCourse}`;
            if(staffSelectedTopic) label = `question(s) in ${staffSelectedCourse}/${staffSelectedTopic}`;
            if(staffSearchQuery.trim()) label += ` matching "${staffSearchQuery}"`;
            countSpan.innerText = `${filteredQuestions.length} ${label}`;
        }
        
        container.innerHTML = filteredQuestions.map((q) => {
            const optionsPreview = q.options.map((opt, i) => `${String.fromCharCode(65+i)}: ${opt.substring(0, 28)}`).join(' · ');
            const courseName = normalizeCourseName(q.courseName);
            const topicName = q.topic || 'General';
            const originalIndex = questionsBank.findIndex(candidate => candidate === q);
            const delAttr = q.id ? `data-id="${q.id}"` : `data-idx="${originalIndex}"`;
            return `
                <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 sm:p-4 transition-all hover:shadow-sm">
                    <div class="flex flex-col sm:flex-row justify-between items-start gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="flex flex-wrap gap-1 sm:gap-2 mb-2">
                                <p class="text-xs text-blue-700 whitespace-nowrap"><span class="material-symbols-outlined mi">school</span>${escapeHtml(courseName)}</p>
                                <p class="text-xs text-purple-700 bg-purple-50 px-2 rounded whitespace-nowrap"><span class="material-symbols-outlined mi">label</span>${escapeHtml(topicName)}</p>
                            </div>
                            <p class="font-semibold text-gray-800 text-sm md:text-base break-words">${escapeHtml(q.text)}</p>
                            <p class="text-xs text-gray-500 mt-1 break-words line-clamp-2">${escapeHtml(optionsPreview)}</p>
                            <p class="text-xs text-green-700 mt-1 whitespace-nowrap"><span class="material-symbols-outlined mi">check_circle</span>Correct: ${q.correctLetter}</p>
                        </div>
                        <button type="button" ${delAttr} class="deleteQuestionBtn flex-shrink-0 text-red-500 hover:text-red-700 bg-white rounded-full p-2 shadow-sm transition hover:shadow-md" aria-label="Delete question"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function updateStaffListUI() {
        const staffCourseFilter = document.getElementById('staffCourseFilter');
        const staffTopicFilter = document.getElementById('staffTopicFilter');
        if(!staffCourseFilter) return;

        renderStaffCourseChips();

        if(staffCourseFilter){
            const courses = getAvailableCourses();
            const currentValue = staffSelectedCourse;
            staffCourseFilter.innerHTML = `<option value="">All courses</option>${courses.map(courseName => `<option value="${escapeHtml(courseName)}">${escapeHtml(courseName)}</option>`).join('')}`;
            if(currentValue && (currentValue === '' || courses.includes(currentValue))){
                staffCourseFilter.value = currentValue;
            } else {
                staffCourseFilter.value = '';
                staffSelectedCourse = '';
            }
            staffCourseFilter.onchange = () => {
                staffSelectedCourse = staffCourseFilter.value || '';
                updateQuestionDisplay();
            };
        }

        const filteredByCoursForTopics = !staffSelectedCourse
            ? questionsBank
            : questionsBank.filter(question => normalizeCourseName(question.courseName) === staffSelectedCourse);
        const uniqueTopics = Array.from(new Set(filteredByCoursForTopics.map(q => (q.topic || 'General')))).sort();

        if(staffTopicFilter){
            staffTopicFilter.innerHTML = `<option value="">All topics</option>${uniqueTopics.map(topic => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('')}`;
            staffTopicFilter.onchange = () => updateQuestionDisplay();
        }

        const searchInput = document.getElementById('questionSearchInput');
        if(searchInput) searchInput.oninput = () => { staffSearchQuery = searchInput.value; updateQuestionDisplay(); };

        const clearBtn = document.getElementById('clearFiltersBtn');
        if(clearBtn) clearBtn.addEventListener('click', () => {
            staffSelectedCourse = ''; staffSearchQuery = '';
            if(staffCourseFilter) staffCourseFilter.value = '';
            if(staffTopicFilter) staffTopicFilter.value = '';
            if(searchInput) searchInput.value = '';
            updateQuestionDisplay();
        });

        updateQuestionDisplay();
        // attach delete events
        document.querySelectorAll('.deleteQuestionBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                const idx = parseInt(btn.getAttribute('data-idx'));
                if(!isNaN(idx) && !id){
                    if(confirm("Delete this question?")){
                        questionsBank.splice(idx, 1);
                        persistQuestions();
                        updateStaffListUI();
                        showToast("Question deleted", "green");
                    }
                    return;
                }
                if(id){
                    if(!confirm("Delete this question from server?")) return;
                    (async ()=>{
                        try{
                            const token = await getAccessToken();
                            const res = await fetch(`${API_BASE}/api/questions/${id}`, { method: 'DELETE', headers: token ? { 'Authorization': 'Bearer '+token } : {} });
                            if(res.ok){ await loadQuestionsFromStorage(); showToast('Question deleted', 'green'); }
                            else showToast('Failed to delete on server', 'red');
                        } catch(e){ showToast('Error deleting', 'red'); }
                    })();
                }
            });
        });
    }



    // Add single question
    function addSingleQuestion(){
        const courseName = normalizeCourseName(document.getElementById('singleCourseName')?.value);
        const topicName = (document.getElementById('singleTopicName')?.value || '').trim() || 'General';
        const qText = document.getElementById('singleQuestionText').value.trim();
        const optA = document.getElementById('optA').value.trim();
        const optB = document.getElementById('optB').value.trim();
        const optC = document.getElementById('optC').value.trim();
        const optD = document.getElementById('optD').value.trim();
        const selectedRadio = document.querySelector('input[name="correctAns"]:checked');
        if(!qText) return showToast("Please enter question text", "red");
        if(!optA || !optB || !optC || !optD) return showToast("All four options required", "red");
        if(!selectedRadio) return showToast("Select correct answer (A-D)", "red");
        const correctLetter = selectedRadio.value;
        const payload = { courseName, topic: topicName, text: qText, options: [optA, optB, optC, optD], correctLetter };
        if(API_BASE){
            (async ()=>{
                try{
                    await createCourse(courseName, { silent: true });
                    const token = await getAccessToken();
                    const res = await fetch(`${API_BASE}/api/questions`, { method: 'POST', headers: Object.assign({ 'Content-Type':'application/json' }, token ? { 'Authorization':'Bearer '+token } : {}), body: JSON.stringify(payload) });
                    if(res.ok){ await loadQuestionsFromStorage(); showToast('Question added', 'green'); }
                    else { const txt = await res.text(); showToast('Failed to add: '+txt, 'red'); }
                } catch(e){ showToast('Error adding question', 'red'); }
            })();
        } else {
            ensureCourseInLocalBank(courseName);
            questionsBank.push({ courseName, topic: topicName, text: qText, options: [optA, optB, optC, optD], correctLetter });
            persistQuestions();
            updateStaffListUI();
            showToast("Question added successfully!", "green");
        }
        // Clear inputs
        document.getElementById('singleCourseName').value = '';
        document.getElementById('singleTopicName').value = '';
        document.getElementById('singleQuestionText').value = '';
        document.getElementById('optA').value = ''; document.getElementById('optB').value = '';
        document.getElementById('optC').value = ''; document.getElementById('optD').value = '';
        if(selectedRadio) selectedRadio.checked = false;
    }

    // Batch upload uses batchParse from lib.js
    function batchUploadFromText(content){
        const parsed = window.batchParse ? window.batchParse(content) : [];
        if(!parsed.length){ showBatchToast("No valid questions found. Check format: Course | Question | A | B | C | D | CorrectLetter"); return; }
        if(API_BASE){
            (async ()=>{
                try{
                    const parsedCourses = Array.from(new Set(parsed.map(item => normalizeCourseName(item.courseName))));
                    for(const courseName of parsedCourses){ await createCourse(courseName, { silent: true }); }
                    const token = await getAccessToken();
                    const res = await fetch(`${API_BASE}/api/import`, { method: 'POST', headers: Object.assign({ 'Content-Type':'application/json' }, token ? { 'Authorization':'Bearer '+token } : {}), body: JSON.stringify(parsed) });
                    if(res.ok){ const j = await res.json(); await loadCourses(); await loadQuestionsFromStorage(); showBatchToast(`Successfully imported ${j.inserted || parsed.length} questions.`); }
                    else { const txt = await res.text(); showBatchToast('Import failed: '+txt); }
                } catch(e){ showBatchToast('Error importing'); }
            })();
        } else {
            for(const q of parsed){ ensureCourseInLocalBank(q.courseName); questionsBank.push(q); }
            persistQuestions(); updateStaffListUI(); showBatchToast(`Successfully added ${parsed.length} questions.`);
        }
    }

    function renderCourseSelection(){
        const quizArea = document.getElementById('activeQuizArea');
        const courses = getAvailableCourses();
        const previewBanner = isStaffPreviewMode ? '<div class="mb-4 p-3 bg-blue-600 text-white rounded-lg text-sm font-medium"><span class="material-symbols-outlined mi">shield</span> <strong>STAFF PREVIEW MODE:</strong> Browsing courses in read-only mode. Role: staff</div>' : '';
        if(courses.length === 0){
            quizArea.innerHTML = `${previewBanner}<div class="text-center p-10"><p class="text-amber-600"><span class="material-symbols-outlined mi">warning</span>No course questions available yet.</p><button id="studentBackToStaffEmpty" class="mt-4 bg-green-600 text-white px-5 py-2 rounded-xl"><span class="material-symbols-outlined mi">arrow_back</span>Back to Staff Panel</button></div>`;
            const backBtn = document.getElementById('studentBackToStaffEmpty');
            if(backBtn) backBtn.addEventListener('click', () => exitStaffPreviewMode());
            return;
        }
        const tiles = courses.map(c => `
            <button type="button" class="course-tile p-3 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 text-green-800 font-medium" data-course="${escapeHtml(c)}">
                <span class="material-symbols-outlined mi">school</span>${escapeHtml(c)}
            </button>
        `).join('');
        quizArea.innerHTML = `
            <div class="max-w-xl mx-auto text-center space-y-4">
                <h3 class="text-2xl font-bold text-gray-800"><span class="material-symbols-outlined mi">menu_book</span>Choose Course</h3>
                <p class="text-sm text-gray-500">Select the course you want to take a quiz on.</p>
                <div id="studentCourseTileGrid" class="grid grid-cols-1 sm:grid-cols-2 gap-3">${tiles}</div>
            </div>
        `;
        document.querySelectorAll('.course-tile').forEach((tile) => {
            tile.addEventListener('click', () => {
                const selected = tile.getAttribute('data-course');
                renderTopicSelection(selected);
            });
        });
    }

    function renderTopicSelection(courseName){
        const quizArea = document.getElementById('activeQuizArea');
        selectedCourse = normalizeCourseName(courseName);
        const previewBanner = isStaffPreviewMode ? '<div class="mb-4 p-3 bg-blue-600 text-white rounded-lg text-sm font-medium"><span class="material-symbols-outlined mi">shield</span> <strong>STAFF PREVIEW MODE</strong> Role: staff</div>' : '';
        
        // Get unique topics for this course
        const coursesTopics = Array.from(new Set(
            questionsBank
                .filter(q => normalizeCourseName(q.courseName) === selectedCourse)
                .map(q => (q.topic || 'General'))
        )).sort();

        if(coursesTopics.length === 0){
            alert(`No topics found for ${selectedCourse}.`);
            renderCourseSelection();
            return;
        }

        const tiles = coursesTopics.map(t => `
            <button type="button" class="topic-tile p-3 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 font-medium" data-topic="${escapeHtml(t)}">
                <span class="material-symbols-outlined mi">label</span>${escapeHtml(t)}
            </button>
        `).join('');
        quizArea.innerHTML = `
            ${previewBanner}
            <div class="max-w-xl mx-auto text-center space-y-4">
                <h3 class="text-2xl font-bold text-gray-800"><span class="material-symbols-outlined mi">label</span>Choose Topic</h3>
                <p class="text-sm text-gray-500">Select a topic from <strong>${escapeHtml(selectedCourse)}</strong></p>
                <div id="studentTopicTileGrid" class="grid grid-cols-1 sm:grid-cols-2 gap-3">${tiles}</div>
                <button type="button" id="backToCourseFromTopicBtn" class="mt-4 text-gray-700 bg-gray-100 hover:bg-gray-200 px-5 py-2 rounded-xl"><span class="material-symbols-outlined mi">arrow_back</span>Back to Courses</button>
            </div>
        `;
        document.querySelectorAll('.topic-tile').forEach((tile) => {
            tile.addEventListener('click', () => {
                const selected = tile.getAttribute('data-topic');
                startNewQuizSession(selectedCourse, selected);
            });
        });
        const backBtn = document.getElementById('backToCourseFromTopicBtn');
        if(backBtn) backBtn.addEventListener('click', renderCourseSelection);
    }

    // ---------- STUDENT QUIZ LOGIC ----------
    function renderStudentQuiz() {
        const quizArea = document.getElementById('activeQuizArea');
        if(!quizActive || quizQuestions.length === 0){
            if(quizQuestions.length === 0 && quizActive){
                quizArea.innerHTML = `<div class="text-center py-10"><p class="text-red-500">No questions available. Please ask staff to add questions.</p><button id="noQuestionsBackBtn" class="mt-4 bg-green-600 text-white px-5 py-2 rounded-xl">Go to Dashboard</button></div>`;
                const backBtn = document.getElementById('noQuestionsBackBtn');
                if(backBtn) backBtn.addEventListener('click', ()=> switchRole('staff'));
            }
            return;
        }
        const q = quizQuestions[currentQIndex];
        const selected = studentAnswers[currentQIndex]?.selectedLetter || null;
        const progress = `${currentQIndex+1} / ${quizQuestions.length}`;
        
        let optionsHtml = '';
        q.options.forEach((opt, idx) => {
            const letter = String.fromCharCode(65+idx);
            const isSelected = (selected === letter);
            const bgClass = isSelected ? 'bg-green-100 border-green-400' : 'bg-white border-gray-200';
            const disabledClass = isStaffPreviewMode ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-50 cursor-pointer';
            optionsHtml += `
                <div class="option-card p-3 rounded-xl border ${bgClass} ${disabledClass} transition-all flex items-center gap-3" data-letter="${letter}" tabindex="0" role="button" aria-pressed="${isSelected}" ${isStaffPreviewMode ? 'disabled' : ''}>
                    <span class="font-bold w-7 h-7 flex items-center justify-center rounded-full ${isSelected ? 'bg-green-600 text-white' : 'bg-gray-100'}">${letter}</span>
                    <span class="text-gray-700">${escapeHtml(opt)}</span>
                </div>
            `;
        });
        
        const staffBadge = isStaffPreviewMode ? '<span class="text-xs font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-full"><span class="material-symbols-outlined mi">preview</span>STAFF PREVIEW (Read-only)</span>' : '<span class="text-xs text-gray-400">Select one option</span>';
        const staffWarning = isStaffPreviewMode ? '<div class="mb-4 p-3 bg-blue-600 text-white rounded-lg text-sm font-medium"><span class="material-symbols-outlined mi">shield</span> <strong>STAFF PREVIEW MODE:</strong> You are viewing this quiz as a staff member in read-only mode. Your answers will NOT be recorded. Role: staff</div>' : '';
        
        // Calculate progress
        const progressPercent = Math.round(((currentQIndex + 1) / quizQuestions.length) * 100);
        const progressBar = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-semibold text-gray-700">Progress</span>
                    <span class="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">${currentQIndex + 1} / ${quizQuestions.length}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div class="bg-green-600 h-2 transition-all duration-300 ease-out" style="width: ${progressPercent}%"></div>
                </div>
            </div>
        `;
        
        const quizHtml = `
            ${staffWarning}
            ${progressBar}
            <div class="mb-6 flex justify-between items-center border-b pb-3">
                <span class="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">${escapeHtml(selectedCourse || 'General')} · Question ${progress}</span>
                ${staffBadge}
            </div>
            <h3 class="text-xl md:text-2xl font-semibold text-gray-800 mb-6">${escapeHtml(q.text)}</h3>
            <div class="space-y-3 mb-8" id="optionsContainer">${optionsHtml}</div>
            <div class="flex justify-between gap-4">
                <button type="button" id="prevQuizBtn" class="px-5 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 disabled:opacity-40" ${currentQIndex === 0 ? 'disabled' : ''} ${isStaffPreviewMode ? 'disabled' : ''}><span class="material-symbols-outlined mi">arrow_back</span>Previous</button>
                <button type="button" id="nextQuizBtn" class="px-6 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl shadow disabled:opacity-50 disabled:cursor-not-allowed" ${isStaffPreviewMode ? 'disabled' : ''}>${currentQIndex === quizQuestions.length-1 ? '<span class="material-symbols-outlined mi">flag</span>Finish Quiz' : '<span class="material-symbols-outlined mi">arrow_forward</span>Next'}</button>
            </div>
        `;
        quizArea.innerHTML = quizHtml;
        
        if(!isStaffPreviewMode) {
            // attach option listeners (click + keyboard) - only for students
            document.querySelectorAll('.option-card').forEach(card => {
                card.addEventListener('click', (e) => selectOptionCard(card));
                card.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOptionCard(card); } });
            });
            document.getElementById('prevQuizBtn')?.addEventListener('click', () => { if(currentQIndex > 0) { currentQIndex--; saveQuizProgress(); renderStudentQuiz(); } });
            document.getElementById('nextQuizBtn')?.addEventListener('click', () => {
                if(!studentAnswers[currentQIndex]?.selectedLetter){ alert("Please select an answer before proceeding."); return; }
                if(currentQIndex === quizQuestions.length-1){ finishQuizAndShowResults(); } else { currentQIndex++; saveQuizProgress(); renderStudentQuiz(); }
            });
        } else {
            // staff preview mode - disable everything
            document.getElementById('prevQuizBtn')?.addEventListener('click', () => alert('Staff members cannot navigate through the quiz in preview mode.'));
            document.getElementById('nextQuizBtn')?.addEventListener('click', () => alert('Staff members cannot take quizzes. Please switch to Student role to complete the quiz.'));
        }
    }

    function selectOptionCard(card){
        const letter = card.getAttribute('data-letter');
        if(!letter) return;
        const isCorrect = (quizQuestions[currentQIndex].correctLetter === letter);
        studentAnswers[currentQIndex] = { selectedLetter: letter, isCorrect };
        saveQuizProgress(); // Save progress after selecting answer
        renderStudentQuiz();
    }

    function finishQuizAndShowResults() {
        const total = quizQuestions.length;
        let correctCount = 0;
        const details = [];
        const startTime = window.quizStartTime || Date.now();
        const durationSeconds = Math.round((Date.now() - startTime) / 1000);
        
        for(let i=0; i<total; i++){
            const ans = studentAnswers[i];
            const q = quizQuestions[i];
            const isCorrect = ans && ans.selectedLetter === q.correctLetter;
            if(isCorrect) correctCount++;
            details.push({ questionText: q.text, userChoice: ans ? ans.selectedLetter : '—', correctLetter: q.correctLetter, isCorrect: isCorrect });
        }
        const scorePercent = (correctCount/total)*100;
        let performanceMsg = '';
        if(scorePercent >= 80) performanceMsg = 'Excellent! Well done.';
        else if(scorePercent >= 60) performanceMsg = 'Good, but keep revising.';
        else performanceMsg = 'Needs revision. Review the questions.';
        
        // Track quiz session if authenticated (skip if staff preview)
        if(API_BASE) {
            trackQuizSession(selectedCourse, scorePercent, total, correctCount, durationSeconds).catch(e => console.warn('Could not track session', e));
        }
        
        const previewBanner = isStaffPreviewMode ? '<div class="mb-4 p-3 bg-blue-600 text-white rounded-lg text-sm font-medium"><span class="material-symbols-outlined mi">shield</span> <strong>STAFF PREVIEW MODE:</strong> This results screen is for preview only. Not recorded. Role: staff</div>' : '';
        const dashboardBtnText = isStaffPreviewMode ? '<span class="material-symbols-outlined mi">arrow_back</span>Back to Staff Panel' : '<span class="material-symbols-outlined mi">dashboard</span>My Dashboard';
        
        let resultsHtml = `
            ${previewBanner}
            <div class="text-center space-y-5">
                <div class="inline-block bg-green-100 p-4 rounded-full"><span class="material-symbols-outlined text-4xl">monitoring</span></div>
                <h2 class="text-3xl font-bold text-gray-800">Quiz Completed!</h2>
                <div class="bg-green-50 rounded-2xl p-6 inline-block w-full max-w-md mx-auto">
                    <p class="text-4xl font-black text-green-700">${correctCount}/${total}</p>
                    <p class="text-lg mt-1">${performanceMsg}</p>
                </div>
                <div class="max-h-64 overflow-y-auto border rounded-xl p-3 text-left bg-gray-50">
                    <p class="font-semibold mb-2"><span class="material-symbols-outlined mi">fact_check</span>Detailed Review</p>
                    ${details.map((d,idx)=>`<div class="border-b py-2 text-sm ${d.isCorrect ? 'text-green-700' : 'text-red-600'}"><span class="font-medium">Q${idx+1}:</span> ${escapeHtml(d.questionText.substring(0,60))} - <strong>Your answer: ${d.userChoice}</strong> ${!d.isCorrect ? `(Correct: ${d.correctLetter})` : '<span class="material-symbols-outlined mi">check</span>'}</div>`).join('')}
                </div>
                <div class="flex flex-wrap gap-4 justify-center pt-4">
                    <button type="button" id="retryQuizBtn" class="bg-green-700 text-white px-6 py-2 rounded-xl shadow"><span class="material-symbols-outlined mi">replay</span>Retry Quiz</button>
                    <button type="button" id="studentGoDashboardBtn" class="bg-gray-200 text-gray-800 px-6 py-2 rounded-xl">${dashboardBtnText}</button>
                </div>
            </div>
        `;
        const quizArea = document.getElementById('activeQuizArea');
        quizArea.innerHTML = resultsHtml;
        quizActive = false;
        clearQuizProgress(); // Clear saved progress when quiz is finished
        document.getElementById('retryQuizBtn')?.addEventListener('click', () => startNewQuizSession(selectedCourse, selectedTopic));
        document.getElementById('studentGoDashboardBtn')?.addEventListener('click', () => {
            if(isStaffPreviewMode) {
                switchRole('staff');
            } else {
                switchToStudentDashboard();
            }
        });
    }

    // ========== ANALYTICS & ADMIN DASHBOARD ==========

    async function trackQuizSession(courseName, scorePercent, totalQuestions, correctAnswers, durationSeconds) {
        // SECURITY: Skip tracking if staff is in preview mode (readonly mode)
        if(isStaffPreviewMode) {
            console.log('Quiz session NOT tracked: Staff preview mode');
            return;
        }
        
        const token = await getAccessToken();
        if(!token) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/quiz-sessions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    course_name: courseName,
                    score: scorePercent,
                    total_questions: totalQuestions,
                    correct_answers: correctAnswers,
                    duration_seconds: durationSeconds
                })
            });
            if(!res.ok) console.warn('Failed to track quiz session');
        } catch(e) {
            console.warn('Error tracking quiz session', e);
        }
    }

    async function loadAnalyticsOverview() {
        const token = await getAccessToken();
        if(!token) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/analytics/overview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(res.ok) {
                const data = await res.json();
                document.getElementById('statTotalSessions').textContent = data.total_quiz_sessions || 0;
                document.getElementById('statUniqueStudents').textContent = data.unique_students || 0;
                document.getElementById('statTotalCourses').textContent = data.total_courses || 0;
                document.getElementById('statAvgScore').textContent = (data.average_score || 0).toFixed(1) + '%';
            }
        } catch(e) {
            console.warn('Error loading analytics overview', e);
        }
    }

    async function loadCourseStats() {
        const token = await getAccessToken();
        if(!token) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/analytics/courses`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(res.ok) {
                const courses = await res.json();
                const tbody = document.getElementById('courseTableBody');
                tbody.innerHTML = courses.length === 0 
                    ? '<tr><td colspan="5" class="text-center py-4 text-gray-400">No data</td></tr>'
                    : courses.map(c => `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="px-4 py-2 font-medium text-gray-800">${escapeHtml(c.course_name)}</td>
                            <td class="px-4 py-2 text-center text-gray-700">${c.total_attempts}</td>
                            <td class="px-4 py-2 text-center text-gray-700">${(c.average_score || 0).toFixed(1)}%</td>
                            <td class="px-4 py-2 text-center text-gray-700">${(c.max_score || 0).toFixed(1)}%</td>
                            <td class="px-4 py-2 text-center text-gray-700">${c.unique_students}</td>
                        </tr>
                    `).join('');
            }
        } catch(e) {
            console.warn('Error loading course stats', e);
        }
    }

    async function loadStudentProgress() {
        const token = await getAccessToken();
        if(!token) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/analytics/students`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(res.ok) {
                const students = await res.json();
                const tbody = document.getElementById('studentTableBody');
                tbody.innerHTML = students.length === 0 
                    ? '<tr><td colspan="6" class="text-center py-4 text-gray-400">No data</td></tr>'
                    : students.map(s => `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="px-4 py-2 text-gray-800">${escapeHtml(s.user_email)}</td>
                            <td class="px-4 py-2 text-gray-700">${escapeHtml(s.course_name)}</td>
                            <td class="px-4 py-2 text-center text-gray-700">${s.total_attempts}</td>
                            <td class="px-4 py-2 text-center text-gray-700">${(s.best_score || 0).toFixed(1)}%</td>
                            <td class="px-4 py-2 text-center text-gray-700">${(s.average_score || 0).toFixed(1)}%</td>
                            <td class="px-4 py-2 text-center text-sm text-gray-600">${s.last_attempted ? new Date(s.last_attempted).toLocaleDateString() : 'Never'}</td>
                        </tr>
                    `).join('');
            }
        } catch(e) {
            console.warn('Error loading student progress', e);
        }
    }

    async function loadQuizSessions() {
        const token = await getAccessToken();
        if(!token) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/analytics/students`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(res.ok) {
                const students = await res.json();
                // Get all unique students
                const uniqueEmails = [...new Set(students.map(s => s.user_email))];
                let allSessions = [];
                
                // Fetch sessions for each student
                for(const email of uniqueEmails.slice(0, 10)) { // Limit to first 10 for performance
                    try {
                        const sessionRes = await fetch(`${API_BASE}/api/analytics/student-detail/${email}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if(sessionRes.ok) {
                            const detail = await sessionRes.json();
                            allSessions = allSessions.concat(detail.sessions || []);
                        }
                    } catch(e) {}
                }
                
                allSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const tbody = document.getElementById('sessionsTableBody');
                tbody.innerHTML = allSessions.length === 0 
                    ? '<tr><td colspan="6" class="text-center py-4 text-gray-400">No sessions recorded</td></tr>'
                    : allSessions.slice(0, 50).map(s => `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="px-4 py-2 text-gray-800">${escapeHtml(s.user_email)}</td>
                            <td class="px-4 py-2 text-gray-700">${escapeHtml(s.course_name)}</td>
                            <td class="px-4 py-2 text-center font-semibold text-gray-700">${(s.score || 0).toFixed(1)}%</td>
                            <td class="px-4 py-2 text-center text-gray-700">${s.correct_answers}/${s.total_questions}</td>
                            <td class="px-4 py-2 text-center text-gray-700">${s.duration_seconds || '-'}</td>
                            <td class="px-4 py-2 text-center text-sm text-gray-600">${new Date(s.created_at).toLocaleDateString()}</td>
                        </tr>
                    `).join('');
            }
        } catch(e) {
            console.warn('Error loading quiz sessions', e);
        }
    }

    function switchToAdminDashboard() {
        currentRole = 'admin';
        document.getElementById('roleSelectionContainer').classList.add('hidden');
        document.getElementById('staffDashboard').classList.add('hidden');
        document.getElementById('studentQuizContainer').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        
        // Load analytics data
        loadAnalyticsOverview();
    }

    function initAnalyticsTabs() {
        document.querySelectorAll('.analytics-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                
                // Update button styles
                document.querySelectorAll('.analytics-tab').forEach(b => {
                    b.classList.remove('bg-purple-700', 'text-white');
                    b.classList.add('bg-gray-100', 'text-gray-700');
                });
                btn.classList.remove('bg-gray-100', 'text-gray-700');
                btn.classList.add('bg-purple-700', 'text-white');
                
                // Update tab content
                document.querySelectorAll('.analytics-tab-content').forEach(tab => {
                    tab.classList.add('hidden');
                });
                
                if(tabName === 'overview') {
                    document.getElementById('analyticsOverviewTab').classList.remove('hidden');
                    loadAnalyticsOverview();
                } else if(tabName === 'courses') {
                    document.getElementById('analyticsCourses').classList.remove('hidden');
                    loadCourseStats();
                } else if(tabName === 'students') {
                    document.getElementById('analyticsStudents').classList.remove('hidden');
                    loadStudentProgress();
                } else if(tabName === 'sessions') {
                    document.getElementById('analyticsSessions').classList.remove('hidden');
                    loadQuizSessions();
                }
            });
        });
    }

    function startNewQuizSession(courseName, topicName) {
        if(questionsBank.length === 0){ alert("No questions available. Staff must add questions first."); switchRole('staff'); return; }
        
        selectedCourse = normalizeCourseName(courseName);
        selectedTopic = (topicName || 'General').trim() || 'General';
        
        // Filter by both course and topic
        quizQuestions = questionsBank.filter(q => 
            normalizeCourseName(q.courseName) === selectedCourse &&
            (q.topic || 'General') === selectedTopic
        );
        
        if(quizQuestions.length === 0){
            alert(`No questions found for ${selectedCourse} - ${selectedTopic}.`);
            renderTopicSelection(selectedCourse);
            return;
        }
        studentAnswers = new Array(quizQuestions.length).fill(null);
        currentQIndex = 0;
        quizActive = true;
        window.quizStartTime = Date.now();
        saveQuizProgress(); // Save initial quiz state
        renderStudentQuiz();
    }

    // ---------- ROLE SWITCH & UI DISPLAY ----------
    function enterStaffPreviewMode() {
        // Enter quiz preview UI while keeping staff role
        const studentDiv = document.getElementById('studentQuizContainer');
        const staffDiv = document.getElementById('staffDashboard');
        const selectionDiv = document.getElementById('roleSelectionContainer');
        const adminDiv = document.getElementById('adminDashboard');
        
        // Show student interface but keep role as 'staff'
        selectionDiv.classList.add('hidden');
        staffDiv.classList.add('hidden');
        studentDiv.classList.remove('hidden');
        adminDiv.classList.add('hidden');
        
        if(questionsBank.length === 0){
            document.getElementById('activeQuizArea').innerHTML = `<div class="text-center p-10"><p class="text-amber-600"><span class="material-symbols-outlined mi">warning</span>No questions yet to preview.</p><button id="studentBackToStaffEmpty" class="mt-4 bg-green-600 text-white px-5 py-2 rounded-xl"><span class="material-symbols-outlined mi">arrow_back</span>Back to Staff Panel</button></div>`;
            const backBtn = document.getElementById('studentBackToStaffEmpty');
            if(backBtn) backBtn.addEventListener('click', exitStaffPreviewMode);
            quizActive = false;
        } else {
            renderCourseSelection();
        }
    }

    function exitStaffPreviewMode() {
        // Exit preview mode and return to staff panel
        isStaffPreviewMode = false;
        currentRole = 'staff'; // Ensure role is staff
        const selectionDiv = document.getElementById('roleSelectionContainer');
        const staffDiv = document.getElementById('staffDashboard');
        const studentDiv = document.getElementById('studentQuizContainer');
        const adminDiv = document.getElementById('adminDashboard');
        
        selectionDiv.classList.add('hidden');
        staffDiv.classList.remove('hidden');
        studentDiv.classList.add('hidden');
        adminDiv.classList.add('hidden');
        updateStaffListUI();
    }

    function switchRole(role){
        // Security: Validate role transitions
        // Students cannot switch to staff role
        if (currentRole === 'student' && role === 'staff') {
            showToast('Students cannot access the staff dashboard', 'red');
            return;
        }
        
        // Exit preview mode before switching roles
        if(isStaffPreviewMode) {
            isStaffPreviewMode = false;
        }
        
        currentRole = role;
        const selectionDiv = document.getElementById('roleSelectionContainer');
        const staffDiv = document.getElementById('staffDashboard');
        const studentDiv = document.getElementById('studentQuizContainer');
        const studentDashboardDiv = document.getElementById('studentDashboard');
        const adminDiv = document.getElementById('adminDashboard');
        
        if(role === 'staff'){
            selectionDiv.classList.add('hidden');
            staffDiv.classList.remove('hidden');
            studentDiv.classList.add('hidden');
            studentDashboardDiv.classList.add('hidden');
            adminDiv.classList.add('hidden');
            updateStaffListUI();
        } else if(role === 'student'){
            selectionDiv.classList.add('hidden');
            staffDiv.classList.add('hidden');
            studentDiv.classList.remove('hidden');
            studentDashboardDiv.classList.add('hidden');
            adminDiv.classList.add('hidden');
            if(questionsBank.length === 0){
                document.getElementById('activeQuizArea').innerHTML = `<div class="text-center p-10"><p class="text-amber-600"><span class="material-symbols-outlined mi">warning</span>No questions yet. Ask staff to add questions.</p><button id="studentBackToStaffEmpty" class="mt-4 bg-green-600 text-white px-5 py-2 rounded-xl"><span class="material-symbols-outlined mi">arrow_back</span>Back to Staff Panel</button></div>`;
                const backBtn = document.getElementById('studentBackToStaffEmpty');
                if(backBtn) backBtn.addEventListener('click', () => {
                    switchRole('staff');
                });
                quizActive = false;
            } else {
                renderCourseSelection();
            }
        } else {
            // show selection - logout
            selectionDiv.classList.remove('hidden');
            staffDiv.classList.add('hidden');
            studentDiv.classList.add('hidden');
            studentDashboardDiv.classList.add('hidden');
            adminDiv.classList.add('hidden');
        }
    }

    // ---------- STUDENT DASHBOARD ----------
    async function loadStudentDashboard() {
        const token = await getAccessToken();
        if(!token) return;
        
        try {
            // Fetch overall stats
            const statsRes = await fetch(`${API_BASE}/api/student-dashboard/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if(statsRes.ok) {
                const stats = await statsRes.json();
                document.getElementById('dashboardTotalAttempts').textContent = stats.total_attempts || 0;
                document.getElementById('dashboardBestScore').textContent = (stats.best_score || 0).toFixed(1) + '%';
                document.getElementById('dashboardAvgScore').textContent = (stats.average_score || 0).toFixed(1) + '%';
            }
            
            // Fetch quiz history
            const historyRes = await fetch(`${API_BASE}/api/student-dashboard/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if(historyRes.ok) {
                const history = await historyRes.json();
                const historyDiv = document.getElementById('studentQuizHistory');
                
                if(history.length === 0) {
                    historyDiv.innerHTML = '<div class="text-center py-8 text-gray-500"><span class="material-symbols-outlined mi">info</span>No quiz attempts yet. Take a quiz to get started!</div>';
                } else {
                    historyDiv.innerHTML = history.map(session => `
                        <div class="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition ${session.score >= 80 ? 'border-green-300 bg-green-50' : session.score >= 60 ? 'border-yellow-300 bg-yellow-50' : 'border-red-300 bg-red-50'}">
                            <div class="flex justify-between items-start gap-2">
                                <div class="flex-1">
                                    <p class="font-semibold text-gray-800">${escapeHtml(session.course_name || 'General')}</p>
                                    <p class="text-xs text-gray-600 mt-1">${new Date(session.created_at).toLocaleDateString()} at ${new Date(session.created_at).toLocaleTimeString()}</p>
                                    ${session.duration_seconds ? `<p class="text-xs text-gray-600">Duration: ${Math.round(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s</p>` : ''}
                                </div>
                                <div class="text-right">
                                    <p class="text-xl font-bold ${session.score >= 80 ? 'text-green-700' : session.score >= 60 ? 'text-yellow-700' : 'text-red-700'}">${session.score.toFixed(1)}%</p>
                                    <p class="text-xs text-gray-600">${session.correct_answers}/${session.total_questions}</p>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch(e) {
            console.warn('Error loading student dashboard', e);
            showToast('Could not load dashboard data', 'red');
        }
    }

    function switchToStudentDashboard() {
        currentRole = 'student';
        const staffDiv = document.getElementById('staffDashboard');
        const studentDiv = document.getElementById('studentQuizContainer');
        const studentDashboardDiv = document.getElementById('studentDashboard');
        const adminDiv = document.getElementById('adminDashboard');
        const selectionDiv = document.getElementById('roleSelectionContainer');
        
        selectionDiv.classList.add('hidden');
        staffDiv.classList.add('hidden');
        studentDiv.classList.add('hidden');
        studentDashboardDiv.classList.remove('hidden');
        adminDiv.classList.add('hidden');
        
        loadStudentDashboard();
    }

    // ---------- EXPORT / IMPORT FEATURE ----------
    function exportQuestions(){
        if(API_BASE){
            (async ()=>{
                try{
                    const token = await getAccessToken();
                    const res = await fetch(`${API_BASE}/api/export`, { headers: token ? { 'Authorization':'Bearer '+token } : {} });
                    if(res.ok){ const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='ecorevise_questions.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
                    else showBatchToast('Failed to export from server');
                } catch(e){ showBatchToast('Export error'); }
            })();
        } else {
            const data = JSON.stringify(questionsBank, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ecorevise_questions.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
    }

    function importQuestionsFromFile(file){
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try{
                const parsed = JSON.parse(ev.target.result);
                if(!Array.isArray(parsed)) return showBatchToast('Invalid file format: expected an array of questions');
                let added = 0;
                for(const q of parsed){
                    if(q && q.text && Array.isArray(q.options) && q.options.length >=4 && ['A','B','C','D'].includes((q.correctLetter||'').toUpperCase())){
                        questionsBank.push({ courseName: normalizeCourseName(q.courseName || q.course_name), text: q.text, options: q.options.slice(0,4), correctLetter: q.correctLetter.toUpperCase() });
                        added++;
                    }
                }
                if(added>0){ persistQuestions(); updateStaffListUI(); showBatchToast(`Imported ${added} questions.`); }
                else showBatchToast('No valid questions found in file');
            } catch(e){ showBatchToast('Failed to parse JSON file'); }
        };
        reader.onerror = () => showBatchToast('Error reading file');
        reader.readAsText(file);
    }

    // ---------- EVENT LISTENERS & DRAG/DROP ----------
    let eventListenersInitialized = false;  // Guard to prevent duplicate initialization
    
    function initEventListeners(){
        if(eventListenersInitialized) return;  // Skip if already initialized
        eventListenersInitialized = true;
        
        // Auth mode tab switching
        const authTabs = document.querySelectorAll('.auth-tab');
        authTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = tab.getAttribute('data-mode');
                // Update tab active state
                authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Update mode visibility
                const signInContainer = document.getElementById('authModeSignIn');
                const signUpContainer = document.getElementById('authModeSignUp');
                if(mode === 'signin') {
                    signInContainer?.classList.add('active');
                    signUpContainer?.classList.remove('active');
                } else if(mode === 'signup') {
                    signInContainer?.classList.remove('active');
                    signUpContainer?.classList.add('active');
                }
            });
        });
        
        // Authentication UI handlers
        const signInStaffBtn = document.getElementById('signInStaffBtn');
        const signInStudentBtn = document.getElementById('signInStudentBtn');
        const signUpBtn = document.getElementById('signUpBtn');
        const guestContinueBtn = document.getElementById('guestContinueBtn');
        if(signInStaffBtn) signInStaffBtn.addEventListener('click', () => handleSignIn('staff'));
        if(signInStudentBtn) signInStudentBtn.addEventListener('click', () => handleSignIn('student'));
        if(signUpBtn) signUpBtn.addEventListener('click', handleSignUp);
        if(guestContinueBtn) guestContinueBtn.addEventListener('click', () => switchRole('student'));
        document.getElementById('staffLogoutBtn')?.addEventListener('click', () => switchRole(null));
        document.getElementById('staffToStudentQuizBtn')?.addEventListener('click', () => {
            // Enter preview mode WITHOUT changing role (keep as 'staff' internally)
            isStaffPreviewMode = true;
            enterStaffPreviewMode();
        });
        document.getElementById('staffToAnalyticsBtn')?.addEventListener('click', switchToAdminDashboard);
        document.getElementById('studentLogoutBtn')?.addEventListener('click', () => switchRole(null));
        document.getElementById('studentToQuizDashboardBtn')?.addEventListener('click', switchToStudentDashboard);
        document.getElementById('studentDashboardToQuizBtn')?.addEventListener('click', () => switchRole('student'));
        document.getElementById('studentDashboardLogoutBtn')?.addEventListener('click', () => switchRole(null));
        document.getElementById('addSingleBtn')?.addEventListener('click', addSingleQuestion);
        document.getElementById('singleCourseName')?.addEventListener('input', renderStaffCourseChips);
        document.getElementById('singleCourseName')?.addEventListener('input', renderStaffTopicChips);
        document.getElementById('singleTopicName')?.addEventListener('input', renderStaffTopicChips);
        document.getElementById('batchUploadBtn')?.addEventListener('click', () => {
            const txt = document.getElementById('batchData').value;
            if(txt.trim()) batchUploadFromText(txt);
            else showBatchToast("Paste some questions in the textarea first");
        });

        // export/import UI
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'px-4 py-2 text-green-700 bg-green-50 rounded-xl hover:bg-green-100 transition';
        exportBtn.innerHTML = '<span class="material-symbols-outlined mi">download</span>Export';
        exportBtn.addEventListener('click', exportQuestions);
        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.className = 'px-4 py-2 text-green-700 bg-green-50 rounded-xl hover:bg-green-100 transition';
        importBtn.innerHTML = '<span class="material-symbols-outlined mi">upload</span>Import';
        const importInput = document.createElement('input');
        importInput.type = 'file'; importInput.accept = '.json'; importInput.className = 'hidden';
        importInput.addEventListener('change', (e) => { if(importInput.files.length) { importQuestionsFromFile(importInput.files[0]); importInput.value = ''; } });
        importBtn.addEventListener('click', () => importInput.click());
        // attach to nav (next to staffToStudentQuizBtn)
        const navRight = document.querySelector('#staffDashboard .flex.gap-3');
        if(navRight){ navRight.insertBefore(importBtn, navRight.firstChild); navRight.insertBefore(exportBtn, navRight.firstChild); document.body.appendChild(importInput); }

        // drag & drop for batch
        const dropZone = document.getElementById('dragDropZone');
        const fileInput = document.getElementById('batchFileInput');
        if(dropZone){
            dropZone.addEventListener('click', () => fileInput.click());
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-area-active'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-area-active'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault(); dropZone.classList.remove('drag-area-active');
                const files = e.dataTransfer.files;
                if(files.length > 0){
                    const file = files[0];
                    if(file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv')){
                        const reader = new FileReader();
                        reader.onload = (ev) => { batchUploadFromText(ev.target.result); };
                        reader.onerror = () => showBatchToast('Error reading file');
                        reader.readAsText(file);
                    } else showBatchToast("Please drop .txt or .csv file");
                }
            });
        }
        if(fileInput){
            fileInput.addEventListener('change', (e) => {
                if(fileInput.files.length){
                    const reader = new FileReader();
                    reader.onload = (ev) => { batchUploadFromText(ev.target.result); fileInput.value = ''; };
                    reader.onerror = () => showBatchToast('Error reading file');
                    reader.readAsText(fileInput.files[0]);
                }
            });
        }

        // Admin dashboard listeners
        document.getElementById('adminBackBtn')?.addEventListener('click', () => switchRole('staff'));
        document.getElementById('adminLogoutBtn')?.addEventListener('click', () => switchRole(null));
        initAnalyticsTabs();
    }

    (async ()=>{
        // Diagnostic: Check Supabase configuration on load
        const testClient = getSupabaseClient();
        if(!testClient){
            console.error('❌ Supabase NOT configured:', {
                URL: window.SUPABASE_URL ? '✓' : '✗',
                KEY: window.SUPABASE_ANON_KEY ? '✓' : '✗'
            });
        } else {
            console.log('✓ Supabase client initialized successfully');
        }
        
        // Auto-restore existing session on page load using auth state listener
        const client = getSupabaseClient();
        if(client) {
            try {
                // Use onAuthStateChange for reliable session restoration
                let sessionChecked = false;
                const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
                    if(!sessionChecked) {
                        sessionChecked = true;
                        if(session?.user) {
                            // User is authenticated, restore their last role
                            const lastRole = localStorage.getItem('ecorevise_last_role') || 'student';
                            await renderUserInfo();
                            await loadQuestionsFromStorage();
                            
                            // Try to restore quiz progress if student has an ongoing quiz
                            if(lastRole === 'student' && restoreQuizProgress()) {
                                console.log('✓ Quiz progress restored');
                                // Show quiz interface directly
                                const studentDiv = document.getElementById('studentQuizContainer');
                                const staffDiv = document.getElementById('staffDashboard');
                                const selectionDiv = document.getElementById('roleSelectionContainer');
                                const adminDiv = document.getElementById('adminDashboard');
                                selectionDiv.classList.add('hidden');
                                staffDiv.classList.add('hidden');
                                studentDiv.classList.remove('hidden');
                                adminDiv.classList.add('hidden');
                                renderStudentQuiz();
                            } else {
                                switchRole(lastRole);
                            }
                        } else {
                            // No session, initialize normally
                            await renderUserInfo();
                            await loadQuestionsFromStorage();
                        }
                    }
                });
                // Unsubscribe after first check to avoid re-initializing
                setTimeout(() => subscription?.unsubscribe?.(), 1000);
            } catch(e) {
                // Fallback: initialize normally
                console.error('Session restoration failed:', e);
                await renderUserInfo();
                await loadQuestionsFromStorage();
                
                // Try to restore quiz progress even in fallback
                if(restoreQuizProgress()) {
                    console.log('✓ Quiz progress restored (fallback)');
                    const studentDiv = document.getElementById('studentQuizContainer');
                    const staffDiv = document.getElementById('staffDashboard');
                    const selectionDiv = document.getElementById('roleSelectionContainer');
                    const adminDiv = document.getElementById('adminDashboard');
                    selectionDiv.classList.add('hidden');
                    staffDiv.classList.add('hidden');
                    studentDiv.classList.remove('hidden');
                    adminDiv.classList.add('hidden');
                    renderStudentQuiz();
                }
            }
        } else {
            await renderUserInfo();
            await loadQuestionsFromStorage();
            
            // Try to restore quiz progress for guest users too
            if(restoreQuizProgress()) {
                console.log('✓ Quiz progress restored (guest)');
                const studentDiv = document.getElementById('studentQuizContainer');
                const staffDiv = document.getElementById('staffDashboard');
                const selectionDiv = document.getElementById('roleSelectionContainer');
                const adminDiv = document.getElementById('adminDashboard');
                selectionDiv.classList.add('hidden');
                staffDiv.classList.add('hidden');
                studentDiv.classList.remove('hidden');
                adminDiv.classList.add('hidden');
                renderStudentQuiz();
            }
            initEventListeners();
        }
    })();
    
    // Initialize event listeners on page load (before auth state is checked)
    // This ensures tab switching works immediately
    initEventListeners();
    
    // Check for email confirmation messages from auth callback
    setTimeout(() => {
        if(sessionStorage.getItem('showEmailConfirmationMessage')) {
            showToast('✓ Email confirmed successfully! Please log in.', 'success');
            sessionStorage.removeItem('showEmailConfirmationMessage');
        }
        
        if(sessionStorage.getItem('emailConfirmationError')) {
            const errorMsg = sessionStorage.getItem('emailConfirmationError');
            showToast('Confirmation failed: ' + errorMsg, 'error');
            sessionStorage.removeItem('emailConfirmationError');
        }
    }, 300);
    
    // initial show role selection by default
    window.switchRole = switchRole;
    // Auth helpers
    async function handleSignIn(role){
        const email = document.getElementById('authEmail')?.value?.trim();
        const password = document.getElementById('authPassword')?.value?.trim();
        if(!email || !password) return showAuthToast('Enter email and password', 'red');
        
        const client = getSupabaseClient();
        if(!client) {
            console.error('Supabase client failed to initialize');
            console.error('URL:', window.SUPABASE_URL || 'NOT SET');
            console.error('Key:', window.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
            showAuthToast('Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.local.js.', 'red');
            return;
        }
        try{
            showAuthToast('Signing in...', 'amber');
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if(error) {
                console.error('Sign-in error:', error);
                return showAuthToast(error.message || 'Sign-in failed. Check email and password.', 'red');
            }
            if(!data.session) {
                console.warn('Sign-in succeeded but no session returned');
                return showAuthToast('Sign-in succeeded but session not established. Try again.', 'red');
            }
            showAuthToast('Signed in successfully.', 'green');
            localStorage.setItem('ecorevise_last_role', role);
            await renderUserInfo();
            switchRole(role);
        } catch(e){ 
            console.error('Sign-in exception:', e);
            showAuthToast('Sign-in error: ' + (e.message || 'Unknown error'), 'red'); 
        }
    }

    async function handleSignUp(){
        const email = document.getElementById('authEmail')?.value?.trim();
        const password = document.getElementById('authPassword')?.value?.trim();
        if(!email || !password) return showToast('Enter email and password', 'red');
        
        const client = getSupabaseClient();
        if(!client) {
            showAuthToast('Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.local.js.', 'red');
            return;
        }
        
        try{
            // If API_BASE is configured, use server endpoint for auto-confirmed signup
            if(API_BASE){
                const res = await fetch(`${API_BASE}/api/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const json = await res.json();
                if(!res.ok){
                    return showAuthToast(json.error || 'Sign-up failed', 'red');
                }
                // Clear form
                document.getElementById('authEmail').value = '';
                document.getElementById('authPassword').value = '';
                showAuthToast('Account created successfully! Your email is ready to use. Now sign in.', 'green');
            } else {
                // Fallback to standard Supabase signup (requires email verification)
                const { data, error } = await client.auth.signUp({ email, password });
                if(error) return showAuthToast(error.message || 'Sign-up failed', 'red');
                // Clear form
                document.getElementById('authEmail').value = '';
                document.getElementById('authPassword').value = '';
                showAuthToast('Account created. Check your email to confirm before signing in.', 'green');
            }
        } catch(e){ 
            showAuthToast('Sign-up error: ' + (e.message || 'Unknown error'), 'red'); 
        }
    }

    async function signOut(){
        const client = getSupabaseClient();
        if(!client) { showAuthToast('Auth is not configured.', 'red'); return; }
        try{
            await client.auth.signOut();
            showToast('Signed out', 'green');
            await renderUserInfo();
            // return to selection screen
            switchRole(null);
        } catch(e){ showToast('Sign-out failed', 'red'); }
    }

    // Render user info and sign-out button into the staff nav
    async function renderUserInfo(){
        const navRight = document.querySelector('#staffDashboard .flex.gap-3');
        // remove existing userInfo if present
        if(navRight){
            const existing = navRight.querySelector('.user-info');
            if(existing) existing.remove();
        }
        const client = getSupabaseClient();
        if(!client) return;
        try{
            const s = await client.auth.getSession();
            const user = s?.data?.session?.user || null;
            if(user && navRight){
                const div = document.createElement('div');
                div.className = 'user-info flex items-center gap-3';
                div.innerHTML = `<span class="text-sm text-gray-700">${escapeHtml(user.email || user.user_metadata?.full_name || 'User')}</span>`;
                const outBtn = document.createElement('button');
                outBtn.type = 'button';
                outBtn.className = 'px-3 py-1 bg-gray-200 rounded-lg text-sm hover:bg-gray-300';
                outBtn.innerText = 'Sign Out';
                outBtn.addEventListener('click', signOut);
                div.appendChild(outBtn);
                navRight.appendChild(div);
            }
        } catch(e){ /* ignore */ }
    }
})();
