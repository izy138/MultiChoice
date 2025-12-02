const { useState, useEffect } = React;

function App() {
    const [apiKey, setApiKey] = useState('');
    const [currentView, setCurrentView] = useState('setup'); // setup, generate, manual, practice, results
    const [inputText, setInputText] = useState('');
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null); // Can be a single index or array for multi-answer
    const [selectedAnswers, setSelectedAnswers] = useState([]); // Array for multi-answer questions
    const [showAnswer, setShowAnswer] = useState(false);
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    
    // Manual input state
    const [manualQuestion, setManualQuestion] = useState({
        question: '',
        options: ['', '', '', ''],
        correctAnswer: null, // Can be a single index or array for multi-answer
        explanation: '',
        isMultiAnswer: false // Toggle for multi-answer questions
    });
    const [savedManualQuestions, setSavedManualQuestions] = useState([]);
    const [practiceOrder, setPracticeOrder] = useState([]);
    const [isOrdering, setIsOrdering] = useState(false);
    const [questionResults, setQuestionResults] = useState({}); // Track which questions were answered correctly/incorrectly
    const [showSidebar, setShowSidebar] = useState(true); // Toggle sidebar visibility
    
    // Model selection state
    const [availableModels, setAvailableModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5-20251001');
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    
    // Question sets management
    const [questionSets, setQuestionSets] = useState({}); // { setId: { name, questions: [] } }
    const [currentSetId, setCurrentSetId] = useState(null);
    const [newSetName, setNewSetName] = useState('');
    const [showSetManager, setShowSetManager] = useState(false);
    const [editingSetId, setEditingSetId] = useState(null);
    const [editingSetName, setEditingSetName] = useState('');
    
    // API key modal state
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    
    // API proxy URL - defaults to local proxy server
    const API_BASE_URL = 'http://localhost:3001/api/anthropic';
    
    // Default JSON file to auto-load for first-time visitors (change this to your preferred file)
    const DEFAULT_QUESTIONS_FILE = 'test 3.json';
    
    // Default name for the auto-loaded question set
    const DEFAULT_QUESTIONS_SET_NAME = 'OS Final Exam Practice';

    // Helper function to load questions from JSON file (URL or local file)
    const loadQuestionsFromJSON = async (urlOrPath, customSetName = null) => {
        try {
            // If it's a full URL, fetch it. Otherwise, treat as relative path
            const url = urlOrPath.startsWith('http') ? urlOrPath : urlOrPath;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load: ${response.statusText}`);
            }
            const data = await response.json();
            
            // Handle different import formats
            let questionsToImport = [];
            if (Array.isArray(data)) {
                questionsToImport = data;
            } else if (data.questions && Array.isArray(data.questions)) {
                questionsToImport = data.questions;
            } else {
                throw new Error('Invalid file format');
            }

            if (questionsToImport.length === 0) {
                throw new Error('No questions found in file');
            }

            // Ensure all imported questions have IDs
            const questionsWithIds = questionsToImport.map((q, index) => ({
                ...q,
                id: q.id || Date.now().toString() + index + Math.random().toString(36).substr(2, 9)
            }));

            // Create or update a question set using functional updates
            let newSetId = null;
            setQuestionSets(prev => {
                // Find existing set ID or create new one
                const existingSetIds = Object.keys(prev);
                const setId = existingSetIds.length > 0 ? existingSetIds[0] : 'set-' + Date.now();
                newSetId = setId;
                
                // Generate a nice name from the filename if it's a new set
                let setName = prev[setId]?.name || 'Imported Set';
                if (!existingSetIds.includes(setId)) {
                    // Use custom name if provided, otherwise extract from filename
                    if (customSetName) {
                        setName = customSetName;
                    } else {
                        // Extract name from filename (remove .json, replace spaces/underscores with spaces, capitalize)
                        const filename = urlOrPath.split('/').pop().replace(/\.json$/i, '');
                        setName = filename
                            .replace(/[-_]/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                    }
                }
                
                const newSet = {
                    name: setName,
                    questions: questionsWithIds,
                    createdAt: prev[setId]?.createdAt || Date.now()
                };
                
                // Update currentSetId if we created a new set
                if (!existingSetIds.includes(setId)) {
                    setCurrentSetId(setId);
                }
                
                return {
                    ...prev,
                    [setId]: newSet
                };
            });

            setSavedManualQuestions(questionsWithIds);
            setError('');
            return true;
        } catch (error) {
            setError(`Failed to load questions: ${error.message}`);
            return false;
        }
    };

    // Load saved data from localStorage
    useEffect(() => {
        const savedApiKey = localStorage.getItem('claudeApiKey');
        const savedModel = localStorage.getItem('selectedModel');
        const savedQuestionSets = localStorage.getItem('questionSets');
        const savedCurrentSetId = localStorage.getItem('currentSetId');
        
        if (savedApiKey) setApiKey(savedApiKey);
        if (savedModel) setSelectedModel(savedModel);
        
        // Check for URL parameters to auto-load JSON file
        const urlParams = new URLSearchParams(window.location.search);
        const loadParam = urlParams.get('load'); // ?load=filename.json or ?load=https://example.com/file.json
        
        if (loadParam) {
            // Determine if it's a URL or a relative path
            const jsonPath = loadParam.startsWith('http') 
                ? loadParam 
                : loadParam; // Will be resolved relative to current page
            
            loadQuestionsFromJSON(jsonPath).then(() => {
                // Navigate to practice view after loading
                setCurrentView('practice');
            });
        }
        
        // Auto-load default questions file for first-time visitors (if no question sets exist)
        const shouldAutoLoadDefault = !savedQuestionSets && !loadParam;
        if (shouldAutoLoadDefault) {
            // Try to load the default file after state is initialized
            // Use a slightly longer delay to ensure all state initialization is complete
            setTimeout(() => {
                loadQuestionsFromJSON(DEFAULT_QUESTIONS_FILE, DEFAULT_QUESTIONS_SET_NAME).catch(() => {
                    // Silently fail if file doesn't exist - user can still import manually
                });
            }, 200);
        }
        
        // Load question sets
        if (savedQuestionSets) {
            try {
                const parsed = JSON.parse(savedQuestionSets);
                setQuestionSets(parsed);
                
                // Migrate old data if it exists
                const savedQuestions = localStorage.getItem('questions');
                const savedManualQuestions = localStorage.getItem('manualQuestions');
                
                if (savedQuestions || savedManualQuestions) {
                    // Create a default set from old data
                    const defaultSetId = 'default-' + Date.now();
                    const oldQuestions = savedQuestions ? JSON.parse(savedQuestions) : [];
                    const oldManualQuestions = savedManualQuestions ? JSON.parse(savedManualQuestions) : [];
                    
                    parsed[defaultSetId] = {
                        name: 'Default Set',
                        questions: oldManualQuestions.length > 0 ? oldManualQuestions : oldQuestions,
                        createdAt: Date.now()
                    };
                    
                    setQuestionSets(parsed);
                    setCurrentSetId(defaultSetId);
                    localStorage.setItem('questionSets', JSON.stringify(parsed));
                    localStorage.setItem('currentSetId', defaultSetId);
                    
                    // Clear old data
                    localStorage.removeItem('questions');
                    localStorage.removeItem('manualQuestions');
                } else if (savedCurrentSetId && parsed[savedCurrentSetId]) {
                    setCurrentSetId(savedCurrentSetId);
                } else if (Object.keys(parsed).length > 0) {
                    // Use first available set
                    const firstSetId = Object.keys(parsed)[0];
                    setCurrentSetId(firstSetId);
                }
            } catch (e) {
            }
        } else {
            // Migrate old data if no sets exist
            const savedQuestions = localStorage.getItem('questions');
            const savedManualQuestions = localStorage.getItem('manualQuestions');
            
            if (savedQuestions || savedManualQuestions) {
                const defaultSetId = 'default-' + Date.now();
                const oldQuestions = savedQuestions ? JSON.parse(savedQuestions) : [];
                const oldManualQuestions = savedManualQuestions ? JSON.parse(savedManualQuestions) : [];
                
                const newSets = {
                    [defaultSetId]: {
                        name: 'Default Set',
                        questions: oldManualQuestions.length > 0 ? oldManualQuestions : oldQuestions,
                        createdAt: Date.now()
                    }
                };
                
                setQuestionSets(newSets);
                setCurrentSetId(defaultSetId);
                localStorage.setItem('questionSets', JSON.stringify(newSets));
                localStorage.setItem('currentSetId', defaultSetId);
                
                // Clear old data
                localStorage.removeItem('questions');
                localStorage.removeItem('manualQuestions');
            }
        }
    }, []);

    // Save question sets to localStorage
    useEffect(() => {
        if (Object.keys(questionSets).length > 0) {
            localStorage.setItem('questionSets', JSON.stringify(questionSets));
        }
    }, [questionSets]);

    // Save current set ID to localStorage
    useEffect(() => {
        if (currentSetId) {
            localStorage.setItem('currentSetId', currentSetId);
        }
    }, [currentSetId]);

    // Update current set's questions when savedManualQuestions changes
    // Use a ref to track if we're loading to prevent circular updates
    const isLoadingSetRef = React.useRef(false);
    
    useEffect(() => {
        if (currentSetId && questionSets[currentSetId] && !isLoadingSetRef.current) {
            const currentSetQuestions = questionSets[currentSetId].questions || [];
            // Only update if questions actually changed
            if (JSON.stringify(currentSetQuestions) !== JSON.stringify(savedManualQuestions)) {
                setQuestionSets(prev => {
                    if (prev[currentSetId]) {
                        return {
                            ...prev,
                            [currentSetId]: {
                                ...prev[currentSetId],
                                questions: savedManualQuestions
                            }
                        };
                    }
                    return prev;
                });
            }
        }
    }, [savedManualQuestions, currentSetId]);

    // Load questionResults from localStorage when currentSetId changes
    useEffect(() => {
        if (currentSetId) {
            const savedResults = localStorage.getItem(`questionResults-${currentSetId}`);
            if (savedResults) {
                try {
                    const parsed = JSON.parse(savedResults);
                    setQuestionResults(parsed);
                } catch (e) {
                }
            } else {
                setQuestionResults({});
            }
        } else {
            setQuestionResults({});
        }
    }, [currentSetId]);

    // Save questionResults to localStorage when it changes
    useEffect(() => {
        if (currentSetId && Object.keys(questionResults).length > 0) {
            localStorage.setItem(`questionResults-${currentSetId}`, JSON.stringify(questionResults));
        }
    }, [questionResults, currentSetId]);

    // Load questions from current set when it changes
    useEffect(() => {
        if (currentSetId && questionSets[currentSetId]) {
            isLoadingSetRef.current = true;
            const setQuestions = questionSets[currentSetId].questions || [];
            setSavedManualQuestions(setQuestions);
            // Reset flag after state update
            setTimeout(() => {
                isLoadingSetRef.current = false;
            }, 0);
        } else if (!currentSetId) {
            isLoadingSetRef.current = true;
            setSavedManualQuestions([]);
            setTimeout(() => {
                isLoadingSetRef.current = false;
            }, 0);
        }
    }, [currentSetId, questionSets]);

    // Reset selections when question index changes
    useEffect(() => {
        if (currentView === 'practice') {
            // Reset selections when navigating to a new question
            // This runs when currentQuestionIndex changes, so it's safe to reset
            const currentQuestions = getCurrentQuestions();
            if (currentQuestions.length > 0) {
                setSelectedAnswer(null);
                setSelectedAnswers([]);
                setShowAnswer(false);
            }
        }
    }, [currentQuestionIndex]); // Only depend on question index, not view

    const saveApiKey = () => {
        localStorage.setItem('claudeApiKey', apiKey);
        setError('');
        alert('API key saved!');
    };

    // Question set management functions
    const createQuestionSet = () => {
        if (!newSetName.trim()) {
            setError('Please enter a name for the question set');
            return;
        }
        
        const setId = 'set-' + Date.now();
        const newSet = {
            name: newSetName.trim(),
            questions: [],
            createdAt: Date.now()
        };
        
        setQuestionSets(prev => ({
            ...prev,
            [setId]: newSet
        }));
        
        // Clear savedManualQuestions before switching to new set
        setSavedManualQuestions([]);
        setCurrentSetId(setId);
        setNewSetName('');
        setError('');
    };

    const selectQuestionSet = (setId) => {
        if (questionSets[setId]) {
            // Set loading flag to prevent save effect from running
            isLoadingSetRef.current = true;
            
            // Get the new set's questions before switching
            const newSetQuestions = questionSets[setId].questions || [];
            
            // Switch to new set and load its questions directly
            setCurrentSetId(setId);
            setSavedManualQuestions(newSetQuestions);
            
            // Reset loading flag after a brief delay
            setTimeout(() => {
                isLoadingSetRef.current = false;
            }, 100);
            
            setShowSetManager(false);
            setError('');
        }
    };

    const renameQuestionSet = (setId) => {
        if (!editingSetName.trim()) {
            setError('Please enter a name for the question set');
            return;
        }
        
        setQuestionSets(prev => ({
            ...prev,
            [setId]: {
                ...prev[setId],
                name: editingSetName.trim()
            }
        }));
        
        setEditingSetId(null);
        setEditingSetName('');
        setError('');
    };

    const deleteQuestionSet = (setId) => {
        if (Object.keys(questionSets).length === 1) {
            setError('Cannot delete the last question set');
            return;
        }
        
        if (confirm(`Are you sure you want to delete "${questionSets[setId]?.name}"? This cannot be undone.`)) {
            const isDeletingCurrentSet = currentSetId === setId;
            const remainingSets = Object.keys(questionSets).filter(id => id !== setId);
            
            if (isDeletingCurrentSet) {
                // Set loading flag to prevent save effect from running
                isLoadingSetRef.current = true;
                
                // Get the new set's questions before deleting
                const newSetId = remainingSets.length > 0 ? remainingSets[0] : null;
                const newSetQuestions = newSetId && questionSets[newSetId] 
                    ? (questionSets[newSetId].questions || [])
                    : [];
                
                // Delete the set
                setQuestionSets(prev => {
                    const newSets = { ...prev };
                    delete newSets[setId];
                    return newSets;
                });
                
                // Switch to new set and load its questions directly
                if (newSetId) {
                    setCurrentSetId(newSetId);
                    setSavedManualQuestions(newSetQuestions);
                } else {
                    setCurrentSetId(null);
                    setSavedManualQuestions([]);
                }
                
                // Reset loading flag after a brief delay
                setTimeout(() => {
                    isLoadingSetRef.current = false;
                }, 100);
            } else {
                // If not deleting current set, just delete it
                setQuestionSets(prev => {
                    const newSets = { ...prev };
                    delete newSets[setId];
                    return newSets;
                });
            }
            
            setError('');
        }
    };

    const generateQuestions = async () => {
        if (!apiKey) {
            setError('Please enter your Claude API key first');
            return;
        }
        if (!inputText.trim()) {
            setError('Please enter some study material');
            return;
        }
        if (!currentSetId) {
            setError('Please select or create a question set first');
            return;
        }

        setIsGenerating(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    apiKey: apiKey,
                    model: selectedModel,
                    max_tokens: 16000,
                    messages: [{
                        role: "user",
                        content: `Convert the following study material into multiple choice questions. For each question, provide:
1. The question text
2. Four answer options (A, B, C, D), or as many as needed to cover the material given.
3. The correct answer letter
4. A brief explanation

Study Material:
${inputText}

Respond ONLY with valid JSON in this exact format (no other text):
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0, 
      "explanation": "Explanation here"
    }
  ]
}

The correctAnswer should be the index (0-3) for single answer questions, or array of indices (0-3): "correctAnswer":[0, 1, 2, 3], for multi-answer questions, where 0, 1, 2, 3 are the indices of the correct options in the options array for multi-answer questions.`
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            // Check if response was truncated
            const stopReason = data.stop_reason;
            if (stopReason === 'max_tokens') {
            }
            
            let responseText = data.content[0].text;
            
            // Strip markdown code blocks if present
            responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            
            // Try to extract JSON even if incomplete
            let jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                responseText = jsonMatch[0];
            }
            
            let parsedData;
            try {
                parsedData = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error(`Failed to parse JSON response: ${parseError.message}. The response may have been truncated.`);
            }
            
            if (parsedData.questions && parsedData.questions.length > 0) {
                // Add IDs to generated questions
                const questionsWithIds = parsedData.questions.map((q, idx) => ({
                    ...q,
                    id: q.id || Date.now().toString() + idx + Math.random().toString(36).substr(2, 9)
                }));
                
                // If there's a current set, add questions to it
                if (currentSetId && questionSets[currentSetId]) {
                    setSavedManualQuestions(prev => [...prev, ...questionsWithIds]);
                } else {
                    // Otherwise, use temporary questions for practice
                    setQuestions(questionsWithIds);
                }
                
                setCurrentView('practice');
                setCurrentQuestionIndex(0);
                setScore({ correct: 0, total: 0 });
            } else {
                throw new Error('No questions generated');
            }
        } catch (err) {
            setError(`Failed to generate questions: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Check if question is multi-answer
    // Multi-answer if:
    // 1. correctAnswer is an array with more than 1 element, OR
    // 2. Question text contains "(Select all that apply)" or similar phrases
    const isMultiAnswer = (question) => {
        if (!question) return false;
        
        // Check if correctAnswer is an array with multiple elements
        if (Array.isArray(question.correctAnswer) && question.correctAnswer.length > 1) {
            return true;
        }
        
        // Check if question text indicates multi-answer
        const questionText = (question.question || '').toLowerCase();
        const multiAnswerPhrases = [
            'select all that apply',
            'select all',
            'choose all',
            'all that apply',
            'all applicable',
            'multiple answers',
            'may select more than one'
        ];
        
        return multiAnswerPhrases.some(phrase => questionText.includes(phrase));
    };

    const handleAnswerSelect = (index, question) => {
        if (showAnswer) return; // Don't allow selection after answer is shown
        
        const isMulti = isMultiAnswer(question);
        
        if (isMulti) {
            // Multi-answer: toggle selection in the array
            setSelectedAnswers(prev => {
                // Create new array without mutating
                if (prev.includes(index)) {
                    // Remove if already selected
                    return prev.filter(i => i !== index);
                } else {
                    // Add if not selected
                    return [...prev, index];
                }
            });
            // Ensure single answer is cleared for multi-answer questions
            setSelectedAnswer(null);
        } else {
            // Single answer: set the single value
            setSelectedAnswer(index);
            // Clear multi-answer array
            setSelectedAnswers([]);
        }
    };

    // Helper function to get current questions
    const getCurrentQuestions = () => {
        if (savedManualQuestions.length > 0 && (practiceOrder.length > 0 || questions.length === 0)) {
            return practiceOrder.length > 0 ? getOrderedQuestions() : savedManualQuestions;
        }
        return questions;
    };

    const submitAnswer = () => {
        const currentQuestions = getCurrentQuestions();
        const currentQuestion = currentQuestions[currentQuestionIndex];
        
        // Check if question requires answers
        if (isMultiAnswer(currentQuestion)) {
            if (selectedAnswers.length === 0) return; // Must select at least one for multi-answer
        } else {
            if (selectedAnswer === null) return; // Must select an answer for single-answer
        }
        
        setShowAnswer(true);
        
        // Check correctness
        let isCorrect;
        const isMulti = isMultiAnswer(currentQuestion);
        
        if (isMulti) {
            // For multi-answer: check if arrays match (same length and all elements present)
            // Normalize correctAnswer to array - if it's a single number, convert to array
            const correctAnswerArray = Array.isArray(currentQuestion.correctAnswer) 
                ? currentQuestion.correctAnswer 
                : [currentQuestion.correctAnswer];
            const correctAnswers = [...correctAnswerArray].sort((a, b) => a - b);
            const selected = [...selectedAnswers].sort((a, b) => a - b);
            
            isCorrect = correctAnswers.length === selected.length && 
                        correctAnswers.every((val, idx) => val === selected[idx]);
        } else {
            // Single answer
            isCorrect = selectedAnswer === currentQuestion.correctAnswer;
        }
        
        setScore(prev => ({
            correct: prev.correct + (isCorrect ? 1 : 0),
            total: prev.total + 1
        }));

        // Track result for sidebar
        if (currentQuestion.id) {
            setQuestionResults(prev => ({
                ...prev,
                [currentQuestion.id]: isCorrect
            }));
        } else {
            // For AI-generated questions without ID, use index
            setQuestionResults(prev => ({
                ...prev,
                [`ai-${currentQuestionIndex}`]: isCorrect
            }));
        }

        // Update performance if it's a manual question
        if (currentQuestion.id) {
            updateQuestionPerformance(currentQuestion.id, isCorrect);
        }
    };

    const nextQuestion = () => {
        const currentQuestions = getCurrentQuestions();
        if (currentQuestionIndex < currentQuestions.length - 1) {
            // Move to next question - useEffect will handle resetting selections
            setCurrentQuestionIndex(prev => prev + 1);
            setShowAnswer(false);
        } else {
            setCurrentView('results');
        }
    };

    const restartPractice = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setSelectedAnswers([]); // Reset multi-answer selection
        setShowAnswer(false);
        setScore({ correct: 0, total: 0 });
        setPracticeOrder([]);
        setQuestionResults({}); // Reset question results
        setCurrentView('practice');
    };

    // Jump to specific question
    const jumpToQuestion = (index) => {
        const currentQuestions = getCurrentQuestions();
        if (index >= 0 && index < currentQuestions.length) {
            // Jump to question - useEffect will handle resetting selections
            setCurrentQuestionIndex(index);
            setShowAnswer(false);
        }
    };

    const startNewSet = () => {
        setCurrentView('generate');
        setInputText('');
    };

    // Manual question input functions
    const addOption = () => {
        setManualQuestion(prev => ({
            ...prev,
            options: [...prev.options, '']
        }));
    };

    const removeOption = (index) => {
        setManualQuestion(prev => {
            let newCorrectAnswer = prev.correctAnswer;
            
            if (prev.isMultiAnswer && Array.isArray(prev.correctAnswer)) {
                // For multi-answer: remove the index and adjust remaining indices
                newCorrectAnswer = prev.correctAnswer
                    .filter(i => i !== index)
                    .map(i => i > index ? i - 1 : i);
                if (newCorrectAnswer.length === 0) {
                    newCorrectAnswer = [];
                }
            } else if (!prev.isMultiAnswer && prev.correctAnswer !== null) {
                // For single answer
                if (prev.correctAnswer === index) {
                    newCorrectAnswer = null;
                } else if (prev.correctAnswer > index) {
                    newCorrectAnswer = prev.correctAnswer - 1;
                } else {
                    newCorrectAnswer = prev.correctAnswer;
                }
            }
            
            return {
                ...prev,
                options: prev.options.filter((_, i) => i !== index),
                correctAnswer: newCorrectAnswer
            };
        });
    };

    const updateOption = (index, value) => {
        setManualQuestion(prev => ({
            ...prev,
            options: prev.options.map((opt, i) => i === index ? value : opt)
        }));
    };

    const saveManualQuestion = () => {
        if (!currentSetId) {
            setError('Please select or create a question set first');
            return;
        }
        if (!manualQuestion.question.trim()) {
            setError('Please enter a question');
            return;
        }
        if (manualQuestion.options.filter(opt => opt.trim()).length < 2) {
            setError('Please enter at least 2 options');
            return;
        }
        if (manualQuestion.isMultiAnswer) {
            if (!Array.isArray(manualQuestion.correctAnswer) || manualQuestion.correctAnswer.length === 0) {
                setError('Please select at least one correct answer for multi-answer question');
                return;
            }
        } else {
            if (manualQuestion.correctAnswer === null) {
                setError('Please select the correct answer');
                return;
            }
        }

        const newQuestion = {
            id: Date.now().toString(),
            question: manualQuestion.question,
            options: manualQuestion.options.filter(opt => opt.trim()),
            correctAnswer: manualQuestion.isMultiAnswer 
                ? manualQuestion.correctAnswer  // Already an array
                : manualQuestion.correctAnswer, // Single index
            explanation: manualQuestion.explanation || 'No explanation provided.',
            // Performance tracking
            timesAnswered: 0,
            timesCorrect: 0,
            lastAnswered: null,
            nextReview: Date.now(),
            needsReview: false, // Track if this question needs review (was answered incorrectly)
            incorrectCount: 0 // Count of times answered incorrectly
        };

        setSavedManualQuestions(prev => [...prev, newQuestion]);
        setManualQuestion({
            question: '',
            options: ['', '', '', ''],
            correctAnswer: null,
            explanation: '',
            isMultiAnswer: false
        });
        setError('');
    };

    const deleteManualQuestion = (id) => {
        setSavedManualQuestions(prev => prev.filter(q => q.id !== id));
    };

    // Export questions to JSON file
    const exportQuestions = () => {
        if (savedManualQuestions.length === 0) {
            setError('No questions to export');
            return;
        }

        const setName = currentSetId && questionSets[currentSetId] 
            ? questionSets[currentSetId].name 
            : 'questions';
        const sanitizedName = setName.replace(/[^a-z0-9]/gi, '-').toLowerCase();

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            questionCount: savedManualQuestions.length,
            questions: savedManualQuestions
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sanitizedName}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setError('');
    };

    // Export a specific question set
    const exportQuestionSet = (setId) => {
        const set = questionSets[setId];
        if (!set || !set.questions || set.questions.length === 0) {
            setError('No questions to export in this set');
            return;
        }

        const sanitizedName = set.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            questionCount: set.questions.length,
            questions: set.questions
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sanitizedName}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setError('');
    };

    // Import questions from JSON file with replace option
    const importQuestions = (event, replaceMode = false) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Handle different import formats
                let questionsToImport = [];
                if (Array.isArray(data)) {
                    // Old format: just an array
                    questionsToImport = data;
                } else if (data.questions && Array.isArray(data.questions)) {
                    // New format: object with questions array
                    questionsToImport = data.questions;
                } else {
                    throw new Error('Invalid file format');
                }

                if (questionsToImport.length === 0) {
                    setError('No questions found in file');
                    return;
                }

                // Create a set if none exists
                if (!currentSetId) {
                    const defaultSetId = 'set-' + Date.now();
                    const defaultSet = {
                        name: 'Imported Set',
                        questions: [],
                        createdAt: Date.now()
                    };
                    setQuestionSets(prev => ({
                        ...prev,
                        [defaultSetId]: defaultSet
                    }));
                    setCurrentSetId(defaultSetId);
                }

                if (replaceMode) {
                    // Clear all and replace with imported questions
                    // Ensure all imported questions have IDs
                    const questionsWithIds = questionsToImport.map((q, index) => ({
                        ...q,
                        id: q.id || Date.now().toString() + index + Math.random().toString(36).substr(2, 9)
                    }));
                    setSavedManualQuestions(questionsWithIds);
                    // Reset practice order and results to force reload
                    setPracticeOrder([]);
                    setQuestionResults({});
                    alert(`Successfully imported and replaced all questions with ${questionsWithIds.length} question(s)! Please restart your practice session.`);
                } else {
                    // Merge with existing questions (update existing by ID or question text, add new ones)
                    const existingIds = new Set(savedManualQuestions.map(q => q.id));
                    // Also create a map by question text for matching without IDs
                    // Normalize question text: trim, lowercase, remove extra spaces
                    const normalizeText = (text) => text.trim().toLowerCase().replace(/\s+/g, ' ');
                    const existingByQuestionText = new Map(
                        savedManualQuestions.map(q => [normalizeText(q.question), q])
                    );
                    
                    const newQuestions = [];
                    const updatedQuestions = [];
                    
                    questionsToImport.forEach((q, idx) => {
                        // Ensure imported question has an ID
                        if (!q.id) {
                            q.id = Date.now().toString() + idx + Math.random().toString(36).substr(2, 9);
                        }
                        
                        const questionTextKey = normalizeText(q.question);
                        
                        // Try to match by ID first
                        if (existingIds.has(q.id)) {
                            // Update existing question by ID
                            updatedQuestions.push(q);
                        } else if (existingByQuestionText.has(questionTextKey)) {
                            // Match by question text if ID doesn't match
                            const existingQuestion = existingByQuestionText.get(questionTextKey);
                            // Use the imported question but keep the existing ID
                            const updatedQuestion = {
                                ...q,
                                id: existingQuestion.id // Keep existing ID to maintain references
                            };
                            updatedQuestions.push(updatedQuestion);
                        } else {
                            // New question
                            newQuestions.push(q);
                        }
                    });

                    if (newQuestions.length > 0 || updatedQuestions.length > 0) {
                        // Create a map of updated questions by ID
                        const updatedMap = new Map(updatedQuestions.map(q => [q.id, q]));
                        
                        // Replace existing questions with updated versions, keep untouched ones, add new ones
                        const finalQuestions = [
                            ...savedManualQuestions.map(q => updatedMap.get(q.id) || q),
                            ...newQuestions
                        ];
                        
                        setSavedManualQuestions(finalQuestions);
                        // Reset practice order and results to force reload
                        setPracticeOrder([]);
                        setQuestionResults({});
                        
                        const messages = [];
                        if (updatedQuestions.length > 0) {
                            messages.push(`Updated ${updatedQuestions.length} existing question(s)`);
                        }
                        if (newQuestions.length > 0) {
                            messages.push(`Added ${newQuestions.length} new question(s)`);
                        }
                        alert(messages.join('. ') + '! Please restart your practice session to see the updated questions.');
                    } else {
                        setError(`All questions already exist. Use "Replace All" to update them.`);
                    }
                }
            } catch (err) {
                setError(`Failed to import: ${err.message}`);
            }
        };

        reader.onerror = () => {
            setError('Failed to read file');
        };

        reader.readAsText(file);
        
        // Reset input so same file can be imported again
        event.target.value = '';
    };

    // Clear all questions
    const clearAllQuestions = () => {
        if (confirm('Are you sure you want to delete all questions? This cannot be undone.')) {
            setSavedManualQuestions([]);
            setError('');
            alert('All questions have been cleared.');
        }
    };

    // Order questions using API for spaced repetition
    const orderQuestionsForPractice = async () => {
        if (!apiKey) {
            setError('Please enter your API key first');
            return;
        }
        if (savedManualQuestions.length === 0) {
            setError('No questions to practice');
            return;
        }

        setIsOrdering(true);
        setError('');

        try {
            // Prepare question data with performance history
            const questionData = savedManualQuestions.map(q => ({
                id: q.id,
                question: q.question,
                timesAnswered: q.timesAnswered || 0,
                timesCorrect: q.timesCorrect || 0,
                lastAnswered: q.lastAnswered || null,
                nextReview: q.nextReview || Date.now()
            }));

            const response = await fetch(`${API_BASE_URL}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    apiKey: apiKey,
                    model: selectedModel,
                    max_tokens: 16000,
                    messages: [{
                        role: "user",
                        content: `Order these questions for optimal spaced repetition practice. Each question has:
- timesAnswered: number of times it's been answered
- timesCorrect: number of times answered correctly
- lastAnswered: timestamp of last attempt (or null if never)
- nextReview: suggested next review timestamp

Questions:
${JSON.stringify(questionData, null, 2)}

Return ONLY valid JSON with this exact format (no other text):
{
  "orderedIds": ["id1", "id2", "id3", ...],
  "reasoning": "Brief explanation of ordering strategy"
}

CRITICAL: You MUST include ALL ${savedManualQuestions.length} question IDs in the orderedIds array. Do NOT omit any questions. The orderedIds array MUST contain exactly ${savedManualQuestions.length} string IDs. Count carefully: there are ${savedManualQuestions.length} total questions, so orderedIds must have ${savedManualQuestions.length} elements. Each ID should be a string.

Order questions so that:
1. Questions answered incorrectly more often come first
2. Questions not answered recently come before recently answered ones
3. Questions that need review based on spaced repetition come first`
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            // Check if response was truncated
            const stopReason = data.stop_reason;
            if (stopReason === 'max_tokens') {
            }
            
            let responseText = data.content[0].text;
            
            // Log the response length for debugging
            
            responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            
            // Try to extract JSON even if incomplete
            let jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                responseText = jsonMatch[0];
            }
            
            // Try to fix incomplete JSON by closing brackets/arrays
            let parsedData;
            try {
                parsedData = JSON.parse(responseText);
            } catch (parseError) {
                
                // Try to extract orderedIds array even if JSON is incomplete
                // Look for orderedIds with an array that might be incomplete
                const orderedIdsPattern = /"orderedIds"\s*:\s*\[([\s\S]*?)(\]|$)/;
                const orderedIdsMatch = responseText.match(orderedIdsPattern);
                
                if (orderedIdsMatch) {
                    // Extract all IDs from the array (even if incomplete)
                    const idsText = orderedIdsMatch[1];
                    // Match all quoted strings in the array
                    const idMatches = idsText.match(/"([^"]+)"/g);
                    const extractedIds = idMatches ? idMatches.map(m => m.replace(/"/g, '')) : [];
                    
                    
                    // Use extracted IDs and add missing ones
                    const allQuestionIds = savedManualQuestions.map(q => q.id);
                    const missingIds = allQuestionIds.filter(id => !extractedIds.includes(id));
                    
                    parsedData = {
                        orderedIds: [...extractedIds, ...missingIds]
                    };
                } else {
                    // If we can't extract orderedIds, just use all questions in original order
                    const allQuestionIds = savedManualQuestions.map(q => q.id);
                    parsedData = {
                        orderedIds: allQuestionIds
                    };
                }
            }
            
            // Always ensure all question IDs are included
            const allQuestionIds = savedManualQuestions.map(q => q.id);
            let orderedIds = parsedData.orderedIds || [];
            
            
            // Find missing IDs that weren't in the ordered list
            const missingIds = allQuestionIds.filter(id => !orderedIds.includes(id));
            
            if (missingIds.length > 0) {
                // Add missing IDs at the end
                orderedIds = [...orderedIds, ...missingIds];
            }
            
            // Validate we have all questions - if not, use all questions
            if (orderedIds.length !== allQuestionIds.length) {
                // Merge to ensure all IDs are present (preserving AI order where possible)
                const orderedSet = new Set(orderedIds);
                const missingFromOrdered = allQuestionIds.filter(id => !orderedSet.has(id));
                orderedIds = [...orderedIds, ...missingFromOrdered];
            }
            
            // Final validation - must have all questions
            if (orderedIds.length === allQuestionIds.length) {
                setPracticeOrder(orderedIds);
                setQuestionResults({}); // Reset question results
                setCurrentView('practice');
                setCurrentQuestionIndex(0);
                setScore({ correct: 0, total: 0 });
            } else {
                // Fallback: use all questions in original order if AI ordering fails
                setPracticeOrder(allQuestionIds);
                setQuestionResults({}); // Reset question results
                setCurrentView('practice');
                setCurrentQuestionIndex(0);
                setScore({ correct: 0, total: 0 });
            }
        } catch (err) {
            setError(`Failed to order questions: ${err.message}`);
        } finally {
            setIsOrdering(false);
        }
    };

    // Get ordered questions for practice
    const getOrderedQuestions = () => {
        if (practiceOrder.length === 0) {
            return savedManualQuestions;
        }
        
        const orderMap = {};
        practiceOrder.forEach((id, index) => {
            orderMap[id] = index;
        });
        
        const ordered = [...savedManualQuestions].sort((a, b) => {
            const aOrder = orderMap[a.id] !== undefined ? orderMap[a.id] : 999;
            const bOrder = orderMap[b.id] !== undefined ? orderMap[b.id] : 999;
            return aOrder - bOrder;
        });
        
        // Ensure we return all questions, even if not in practiceOrder
        if (ordered.length !== savedManualQuestions.length) {
            // Find missing questions and add them at the end
            const orderedIds = new Set(ordered.map(q => q.id));
            const missing = savedManualQuestions.filter(q => !orderedIds.has(q.id));
            ordered.push(...missing);
        }
        
        return ordered;
    };

    // Update question performance after answering
    const updateQuestionPerformance = (questionId, isCorrect) => {
        setSavedManualQuestions(prev => prev.map(q => {
            if (q.id === questionId) {
                const wasIncorrect = !isCorrect;
                return {
                    ...q,
                    timesAnswered: (q.timesAnswered || 0) + 1,
                    timesCorrect: (q.timesCorrect || 0) + (isCorrect ? 1 : 0),
                    lastAnswered: Date.now(),
                    nextReview: Date.now() + (isCorrect ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000), // 24h if correct, 2h if wrong
                    needsReview: wasIncorrect ? true : false, // Mark as needs review if incorrect, remove flag if correct
                    incorrectCount: wasIncorrect ? ((q.incorrectCount || 0) + 1) : (q.incorrectCount || 0)
                };
            }
            return q;
        }));
    };

    // Get questions that need review (incorrectly answered)

    // Setup View
    if (currentView === 'setup') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-lg shadow-xl p-8 relative">
                        {/* Header with Connect API Key button */}
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">Multiple Choice Practice</h1>
                                <p className="text-gray-600 mb-6">Transform any study material into practice questions</p>
                            </div>
                            <button
                                onClick={() => setShowApiKeyModal(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium whitespace-nowrap"
                            >
                                {apiKey ? '✓ API Connected' : 'Connect API Key'}
                            </button>
                        </div>
                        
                        {/* Question Set Management */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Question Sets
                            </label>
                            
                            <div className="space-y-3">
                                {/* Create new set */}
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={newSetName}
                                        onChange={(e) => setNewSetName(e.target.value)}
                                        placeholder="New set name..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        onKeyPress={(e) => e.key === 'Enter' && createQuestionSet()}
                                    />
                                    <button
                                        onClick={createQuestionSet}
                                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                                    >
                                        Create Set
                                    </button>
                                </div>
                                
                                {/* List of sets */}
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {Object.entries(questionSets).map(([setId, set]) => (
                                        <div
                                            key={setId}
                                            className={`flex items-center justify-between p-3 rounded-lg border ${
                                                currentSetId === setId
                                                    ? 'bg-blue-50 border-blue-300'
                                                    : 'bg-white border-gray-200'
                                            }`}
                                        >
                                            <div className="flex-1">
                                                {editingSetId === setId ? (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={editingSetName}
                                                            onChange={(e) => setEditingSetName(e.target.value)}
                                                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                                            onKeyPress={(e) => e.key === 'Enter' && renameQuestionSet(setId)}
                                                        />
                                                        <button
                                                            onClick={() => renameQuestionSet(setId)}
                                                            className="text-green-600 hover:text-green-800 text-sm px-2"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingSetId(null);
                                                                setEditingSetName('');
                                                            }}
                                                            className="text-gray-600 hover:text-gray-800 text-sm px-2"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => selectQuestionSet(setId)}
                                                            className="text-left flex-1 text-sm font-medium text-gray-800 hover:text-blue-600"
                                                        >
                                                            {set.name} ({set.questions?.length || 0} questions)
                                                        </button>
                                                        <label 
                                                            className="bg-orange-600 text-white py-1 px-2 rounded text-xs cursor-pointer hover:bg-orange-700 transition"
                                                            onClick={() => {
                                                                // Select this set before importing
                                                                if (currentSetId !== setId) {
                                                                    selectQuestionSet(setId);
                                                                }
                                                            }}
                                                        >
                                                            📤 Import
                                                            <input
                                                                type="file"
                                                                accept=".json"
                                                                onChange={importQuestions}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                        <button
                                                            onClick={() => exportQuestionSet(setId)}
                                                            disabled={!set.questions || set.questions.length === 0}
                                                            className="bg-teal-600 text-white py-1 px-2 rounded text-xs hover:bg-teal-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                                        >
                                                            📥 Export
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {editingSetId !== setId && (
                                                <div className="flex gap-1 ml-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingSetId(setId);
                                                            setEditingSetName(set.name);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 text-sm px-2"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => deleteQuestionSet(setId)}
                                                        className="text-red-600 hover:text-red-800 text-sm px-2"
                                                        disabled={Object.keys(questionSets).length === 1}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                
                                {Object.keys(questionSets).length === 0 && (
                                    <div className="text-sm text-gray-500 text-center py-4">
                                        No question sets yet. Create one to get started!
                                    </div>
                                )}
                            </div>
                            
                            {/* Practice button - below the list */}
                            {currentSetId && questionSets[currentSetId] && (questionSets[currentSetId].questions?.length || 0) > 0 && (
                                <div className="mt-4 pt-3 border-t">
                                    <button
                                        onClick={() => {
                                            // Load saved questionResults from localStorage (already loaded via useEffect)
                                            // Don't reset questionResults - preserve progress
                                            setPracticeOrder([]);
                                            
                                            // Find first unanswered question, or start at 0 if all answered
                                            const savedResults = localStorage.getItem(`questionResults-${currentSetId}`);
                                            let startIndex = 0;
                                            if (savedResults) {
                                                try {
                                                    const parsed = JSON.parse(savedResults);
                                                    const questions = questionSets[currentSetId].questions || [];
                                                    const firstUnanswered = questions.findIndex((q, idx) => {
                                                        const key = q.id || `ai-${idx}`;
                                                        return parsed[key] === undefined;
                                                    });
                                                    if (firstUnanswered !== -1) {
                                                        startIndex = firstUnanswered;
                                                    }
                                                } catch (e) {
                                                }
                                            }
                                            
                                            setCurrentView('practice');
                                            setCurrentQuestionIndex(startIndex);
                                            setScore({ correct: 0, total: 0 }); // Reset score for new session
                                        }}
                                        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition font-semibold"
                                    >
                                        Practice Questions ({questionSets[currentSetId].questions?.length || 0})
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Manually Add Questions Button */}
                        <button
                            onClick={() => {
                                setCurrentView('manual');
                                setError('');
                            }}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition mb-3"
                        >
                            Manually Add Questions
                        </button>
                        
                        {/* API Key Modal */}
                        {showApiKeyModal && (
                            <div 
                                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                                onClick={(e) => {
                                    if (e.target === e.currentTarget) {
                                        setShowApiKeyModal(false);
                                        setError('');
                                    }
                                }}
                            >
                                <div 
                                    className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-xl font-bold text-gray-800">Connect Claude API</h2>
                                        <button
                                            onClick={() => {
                                                setShowApiKeyModal(false);
                                                setError('');
                                            }}
                                            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Claude API Key
                                        </label>
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="sk-ant-..."
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <p className="text-sm text-gray-500 mt-2">
                                            Get your API key from <a href="https://console.anthropic.com/" target="_blank" className="text-blue-600 hover:underline">console.anthropic.com</a>
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            saveApiKey();
                                            setShowApiKeyModal(false);
                                        }}
                                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition mb-4"
                                    >
                                        Save API Key
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (apiKey) {
                                                setCurrentView('generate');
                                                setShowApiKeyModal(false);
                                            } else {
                                                setError('Please enter your API key first');
                                            }
                                        }}
                                        disabled={!apiKey}
                                        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        Generate Questions from Text
                                    </button>
                                    
                                    {error && (
                                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm mt-4">
                                            {error}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Error display - always visible */}
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm mt-4">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Generate View
    if (currentView === 'generate') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white rounded-lg shadow-xl p-8">
                        <button
                            onClick={() => setCurrentView('setup')}
                            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
                        >
                            ← Back to Setup
                        </button>

                        <h2 className="text-2xl font-bold text-gray-800 mb-4">Enter Study Material</h2>
                        <p className="text-gray-600 mb-4">
                            Paste your notes, textbook content, or any material you want to study. The AI will convert it into multiple choice questions.
                        </p>

                        {/* Set Selector */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Select or Create Question Set
                            </label>
                            
                            {/* Create new set */}
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={newSetName}
                                    onChange={(e) => setNewSetName(e.target.value)}
                                    placeholder="New set name..."
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    onKeyPress={(e) => e.key === 'Enter' && createQuestionSet()}
                                />
                                <button
                                    onClick={createQuestionSet}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                                >
                                    Create Set
                                </button>
                            </div>
                            
                            {/* Select existing set */}
                            {Object.keys(questionSets).length > 0 && (
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-2">
                                        Or select existing set:
                                    </label>
                                    <select
                                        value={currentSetId || ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                selectQuestionSet(e.target.value);
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="">-- Select a set --</option>
                                        {Object.entries(questionSets).map(([setId, set]) => (
                                            <option key={setId} value={setId}>
                                                {set.name} ({set.questions?.length || 0} questions)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            {currentSetId && questionSets[currentSetId] && (
                                <div className="mt-3 text-sm font-semibold text-blue-700">
                                    ✓ Selected: {questionSets[currentSetId].name}
                                </div>
                            )}
                        </div>

                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Example: The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration..."
                            className="w-full h-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                        />

                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={generateQuestions}
                            disabled={isGenerating || !inputText.trim() || !currentSetId}
                            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                        >
                            {isGenerating ? 'Generating Questions...' : 'Generate Multiple Choice Questions'}
                        </button>
                        {!currentSetId && (
                            <p className="text-sm text-red-600 mt-2 text-center">
                                Please select or create a question set first
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Manual Input View
    if (currentView === 'manual') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white rounded-lg shadow-xl p-8">
                        <button
                            onClick={() => setCurrentView('setup')}
                            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
                        >
                            ← Back to Setup
                        </button>

                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Add Question Manually</h2>

                        {/* Set Selector */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Select or Create Question Set
                            </label>
                            
                            {/* Create new set */}
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={newSetName}
                                    onChange={(e) => setNewSetName(e.target.value)}
                                    placeholder="New set name..."
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    onKeyPress={(e) => e.key === 'Enter' && createQuestionSet()}
                                />
                                <button
                                    onClick={createQuestionSet}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                                >
                                    Create Set
                                </button>
                            </div>
                            
                            {/* Select existing set */}
                            {Object.keys(questionSets).length > 0 && (
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-2">
                                        Or select existing set:
                                    </label>
                                    <select
                                        value={currentSetId || ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                selectQuestionSet(e.target.value);
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="">-- Select a set --</option>
                                        {Object.entries(questionSets).map(([setId, set]) => (
                                            <option key={setId} value={setId}>
                                                {set.name} ({set.questions?.length || 0} questions)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            {currentSetId && questionSets[currentSetId] && (
                                <div className="mt-3 text-sm font-semibold text-blue-700">
                                    ✓ Selected: {questionSets[currentSetId].name}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Question
                                </label>
                                <textarea
                                    value={manualQuestion.question}
                                    onChange={(e) => setManualQuestion(prev => ({ ...prev, question: e.target.value }))}
                                    placeholder="Enter your question here..."
                                    className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        id="isMultiAnswer"
                                        checked={manualQuestion.isMultiAnswer}
                                        onChange={(e) => {
                                            setManualQuestion(prev => ({
                                                ...prev,
                                                isMultiAnswer: e.target.checked,
                                                correctAnswer: e.target.checked ? [] : null
                                            }));
                                        }}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <label htmlFor="isMultiAnswer" className="text-sm font-medium text-gray-700">
                                        Select all that apply (multi-answer question)
                                    </label>
                                </div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Answer Choices
                                </label>
                                {manualQuestion.options.map((option, index) => (
                                    <div key={index} className="flex items-center gap-2 mb-2">
                                        {manualQuestion.isMultiAnswer ? (
                                            <input
                                                type="checkbox"
                                                checked={Array.isArray(manualQuestion.correctAnswer) && manualQuestion.correctAnswer.includes(index)}
                                                onChange={(e) => {
                                                    setManualQuestion(prev => {
                                                        const currentAnswers = Array.isArray(prev.correctAnswer) ? prev.correctAnswer : [];
                                                        if (e.target.checked) {
                                                            return { ...prev, correctAnswer: [...currentAnswers, index] };
                                                        } else {
                                                            return { ...prev, correctAnswer: currentAnswers.filter(i => i !== index) };
                                                        }
                                                    });
                                                }}
                                                className="w-5 h-5 text-blue-600"
                                            />
                                        ) : (
                                            <input
                                                type="radio"
                                                name="correctAnswer"
                                                checked={manualQuestion.correctAnswer === index}
                                                onChange={() => setManualQuestion(prev => ({ ...prev, correctAnswer: index }))}
                                                className="w-5 h-5 text-blue-600"
                                            />
                                        )}
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => updateOption(index, e.target.value)}
                                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        {manualQuestion.options.length > 2 && (
                                            <button
                                                onClick={() => removeOption(index)}
                                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={addOption}
                                    className="mt-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition border border-blue-300"
                                >
                                    + Add Option
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Explanation (Optional)
                                </label>
                                <textarea
                                    value={manualQuestion.explanation}
                                    onChange={(e) => setManualQuestion(prev => ({ ...prev, explanation: e.target.value }))}
                                    placeholder="Explain why the correct answer is correct..."
                                    className="w-full h-20 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <button
                            onClick={saveManualQuestion}
                            disabled={!currentSetId}
                            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition font-semibold mb-4 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            Save Question
                        </button>
                        {!currentSetId && (
                            <p className="text-sm text-red-600 mb-4 text-center">
                                Please select or create a question set first
                            </p>
                        )}

                        {savedManualQuestions.length > 0 && (
                            <div className="mt-8 border-t pt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        Saved Questions ({savedManualQuestions.length})
                                    </h3>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={exportQuestions}
                                            className="bg-teal-600 text-white py-1.5 px-3 rounded-lg hover:bg-teal-700 transition text-sm"
                                        >
                                            📥 Export
                                        </button>
                                        <label className="bg-orange-600 text-white py-1.5 px-3 rounded-lg hover:bg-orange-700 transition text-sm cursor-pointer">
                                            📤 Import
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={importQuestions}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {savedManualQuestions.map((q) => (
                                        <div key={q.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="font-medium text-gray-800 flex-1">{q.question}</p>
                                                <button
                                                    onClick={() => deleteManualQuestion(q.id)}
                                                    className="ml-4 text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                <span className="mr-4">
                                                    Answered: {q.timesAnswered || 0} times
                                                </span>
                                                <span>
                                                    Correct: {q.timesCorrect || 0} times
                                                </span>
                                                {q.timesAnswered > 0 && (
                                                    <span className="ml-4">
                                                        Accuracy: {Math.round((q.timesCorrect / q.timesAnswered) * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Practice View
    if (currentView === 'practice') {
        // Determine which questions to use
        let currentQuestions = [];
        if (savedManualQuestions.length > 0 && (practiceOrder.length > 0 || questions.length === 0)) {
            // Use manual questions (ordered or not)
            currentQuestions = practiceOrder.length > 0 ? getOrderedQuestions() : savedManualQuestions;
        } else {
            // Use AI-generated questions
            currentQuestions = questions;
        }
        if (currentQuestions.length === 0) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
                            <p className="text-gray-600 mb-4">No questions available for practice.</p>
                            <button
                                onClick={() => setCurrentView('setup')}
                                className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
                            >
                                Back to Setup
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        const currentQuestion = currentQuestions[currentQuestionIndex];
        
        const getQuestionResult = (question, index) => {
            const key = question.id || `ai-${index}`;
            return questionResults[key];
        };

        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex gap-4">
                        {/* Sidebar - Question List */}
                        {showSidebar && (
                            <div className="w-64 bg-white rounded-lg shadow-xl p-4 h-fit sticky top-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-semibold text-gray-800 text-sm">Questions</h3>
                                    <button
                                        onClick={() => setShowSidebar(false)}
                                        className="text-gray-400 hover:text-gray-600 text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                                    {currentQuestions.map((q, index) => {
                                        const result = getQuestionResult(q, index);
                                        const isCurrent = index === currentQuestionIndex;
                                        const questionId = q.id || `ai-${index}`;
                                        
                                        let bgColor = "bg-gray-50";
                                        if (isCurrent) bgColor = "bg-blue-100 border-2 border-blue-500";
                                        else if (result === true) bgColor = "bg-green-50";
                                        else if (result === false) bgColor = "bg-red-50";
                                        
                                        return (
                                            <button
                                                key={questionId}
                                                onClick={() => jumpToQuestion(index)}
                                                className={`w-full text-left px-3 py-2 rounded text-sm transition ${bgColor} hover:bg-blue-100 flex items-center justify-between`}
                                            >
                                                <span className={`flex items-center ${isCurrent ? 'font-semibold' : ''}`}>
                                                    <span className="mr-2 text-xs text-gray-500">#{index + 1}</span>
                                                    <span className="truncate max-w-[150px]">
                                                        {q.question.substring(0, 30)}...
                                                    </span>
                                                </span>
                                                <span className="ml-2 flex-shrink-0">
                                                    {result === true && <span className="text-green-600 font-bold">✓</span>}
                                                    {result === false && <span className="text-red-600 font-bold">✗</span>}
                                                    {result === undefined && <span className="text-gray-300">○</span>}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Main Content */}
                        <div className={`flex-1 bg-white rounded-lg shadow-xl p-8 ${!showSidebar ? 'max-w-3xl mx-auto' : ''}`}>
                            {!showSidebar && (
                                <button
                                    onClick={() => setShowSidebar(true)}
                                    className="mb-4 text-blue-600 hover:text-blue-800 text-sm flex items-center"
                                >
                                    ☰ Show Question List
                                </button>
                            )}
                        <div className="flex justify-between items-center mb-6">
                            <button
                                onClick={() => {
                                    setCurrentView('setup');
                                }}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                ← Exit Practice
                            </button>
                            <div className="text-sm text-gray-600">
                                Question {currentQuestionIndex + 1} of {currentQuestions.length}
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="text-sm text-gray-500 mb-2">Score: {score.correct} / {score.total}</div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                    style={{ width: `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%` }}
                                ></div>
                            </div>
                            {currentQuestion.id && (
                                <div className="text-xs text-gray-500 mt-2">
                                    Answered {currentQuestion.timesAnswered || 0} times • 
                                    Correct {currentQuestion.timesCorrect || 0} times
                                </div>
                            )}
                        </div>

                        <h3 className="text-xl font-semibold text-gray-800 mb-2">
                            {currentQuestion.question}
                        </h3>
                        {isMultiAnswer(currentQuestion) && (
                            <p className="text-sm text-gray-600 mb-6 italic font-semibold bg-yellow-50 border border-yellow-200 px-3 py-2 rounded">
                                (Select all that apply - Multiple answers required)
                            </p>
                        )}

                        <div className="space-y-3 mb-6">
                            {currentQuestion.options.map((option, index) => {
                                const isMulti = isMultiAnswer(currentQuestion);
                                const isSelected = isMulti ? selectedAnswers.includes(index) : selectedAnswer === index;
                                const isCorrectOption = isMulti 
                                    ? Array.isArray(currentQuestion.correctAnswer) && currentQuestion.correctAnswer.includes(index)
                                    : index === currentQuestion.correctAnswer;
                                
                                let buttonClass = "w-full text-left px-4 py-3 border-2 rounded-lg transition flex items-start gap-3 ";
                                
                                if (!showAnswer) {
                                    if (isSelected) {
                                        buttonClass += "border-blue-600 bg-blue-50";
                                    } else {
                                        buttonClass += "border-gray-300 hover:border-blue-400";
                                    }
                                } else {
                                    // Show answer feedback
                                    if (isCorrectOption) {
                                        buttonClass += "border-green-600 bg-green-50";
                                    } else if (isSelected && !isCorrectOption) {
                                        buttonClass += "border-red-600 bg-red-50";
                                    } else {
                                        buttonClass += "border-gray-300";
                                    }
                                }

                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleAnswerSelect(index, currentQuestion)}
                                        disabled={showAnswer}
                                        className={buttonClass}
                                    >
                                        <span className={`flex-shrink-0 mt-0.5 ${isMulti ? 'w-5 h-5 border-2 rounded' : 'w-5 h-5 border-2 rounded-full'} ${
                                            isSelected 
                                                ? 'bg-blue-600 border-blue-600' 
                                                : 'bg-white border-gray-400'
                                        }`}>
                                            {isSelected && (
                                                <span className="text-white text-xs flex items-center justify-center h-full">
                                                    {isMulti ? '✓' : '●'}
                                                </span>
                                            )}
                                        </span>
                                        <span className="flex-1">
                                            <span className="font-semibold">{String.fromCharCode(65 + index)}.</span> {option}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {showAnswer && (() => {
                            const isMulti = isMultiAnswer(currentQuestion);
                            let isCorrect;
                            if (isMulti) {
                                // Normalize correctAnswer to array - if it's a single number, convert to array
                                const correctAnswerArray = Array.isArray(currentQuestion.correctAnswer) 
                                    ? currentQuestion.correctAnswer 
                                    : [currentQuestion.correctAnswer];
                                const correctAnswers = [...correctAnswerArray].sort((a, b) => a - b);
                                const selected = [...selectedAnswers].sort((a, b) => a - b);
                                
                                isCorrect = correctAnswers.length === selected.length && 
                                            correctAnswers.every((val, idx) => val === selected[idx]);
                            } else {
                                isCorrect = selectedAnswer === currentQuestion.correctAnswer;
                            }
                            
                            return (
                                <div className={`p-4 rounded-lg mb-6 ${
                                    isCorrect 
                                        ? 'bg-green-100 border border-green-400' 
                                        : 'bg-red-100 border border-red-400'
                                }`}>
                                    <p className="font-semibold mb-2">
                                        {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                    </p>
                                    {!isCorrect && isMulti && (
                                        <p className="text-sm mb-2">
                                            Correct answers: {Array.isArray(currentQuestion.correctAnswer) 
                                                ? currentQuestion.correctAnswer.map(i => String.fromCharCode(65 + i)).join(', ')
                                                : String.fromCharCode(65 + currentQuestion.correctAnswer)}
                                        </p>
                                    )}
                                    <p className="text-sm">{currentQuestion.explanation}</p>
                                </div>
                            );
                        })()}

                        <div className="flex gap-3">
                            {!showAnswer ? (
                                <button
                                    onClick={submitAnswer}
                                    disabled={isMultiAnswer(currentQuestion) 
                                        ? selectedAnswers.length === 0 
                                        : selectedAnswer === null}
                                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                                >
                                    Submit Answer{isMultiAnswer(currentQuestion) && selectedAnswers.length > 0 && ` (${selectedAnswers.length} selected)`}
                                </button>
                            ) : (
                                <button
                                    onClick={nextQuestion}
                                    className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition font-semibold"
                                >
                                    {currentQuestionIndex < currentQuestions.length - 1 ? 'Next Question →' : 'View Results'}
                                </button>
                            )}
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Results View
    if (currentView === 'results') {
        const percentage = Math.round((score.correct / score.total) * 100);
        
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-lg shadow-xl p-8 text-center">
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">
                            Practice Complete!
                        </h2>
                        
                        <div className="my-8">
                            <div className="text-6xl font-bold text-blue-600 mb-2">{percentage}%</div>
                            <div className="text-xl text-gray-600">
                                {score.correct} out of {score.total} correct
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={restartPractice}
                                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-semibold"
                            >
                                Practice Again
                            </button>
                            <button
                                onClick={startNewSet}
                                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition font-semibold"
                            >
                                Create New Questions
                            </button>
                            <button
                                onClick={() => setCurrentView('setup')}
                                className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition font-semibold"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

ReactDOM.render(<App />, document.getElementById('root'));

