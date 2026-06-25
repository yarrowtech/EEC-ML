import React, { useEffect, useState, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Book, 
  Search, 
  FileText, 
  Calculator, 
  Lightbulb, 
  BookOpen, 
  Upload, 
  Mic, 
  Image, 
  MoreVertical, 
  ChevronLeft, 
  Minimize2, 
  Maximize2, 
  X,
  Sparkles,
  Brain,
  HelpCircle,
  Target,
  CheckCircle,
  Clock,
  User
} from 'lucide-react';

const AITextbookChat = ({ isOpen, onToggle, isMinimized, onMinimize }) => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      type: 'ai',
      content: "Hello! I'm your AI Study Assistant. I can help you understand your textbooks, solve problems, and provide explanations. What would you like to learn today?",
      timestamp: Date.now(),
      suggestions: [
        "Explain this math problem",
        "Summarize this chapter",
        "Help with physics concepts",
        "Practice questions"
      ]
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedTextbook, setSelectedTextbook] = useState('all');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);

  // Available subjects and textbooks
  const subjects = [
    { id: 'all', name: 'All Subjects', icon: BookOpen, color: 'bg-gray-500' },
    { id: 'math', name: 'Mathematics', icon: Calculator, color: 'bg-blue-500' },
    { id: 'physics', name: 'Physics', icon: Target, color: 'bg-purple-500' },
    { id: 'chemistry', name: 'Chemistry', icon: Bot, color: 'bg-green-500' },
    { id: 'biology', name: 'Biology', icon: Book, color: 'bg-emerald-500' },
    { id: 'english', name: 'English', icon: FileText, color: 'bg-orange-500' },
    { id: 'history', name: 'History', icon: BookOpen, color: 'bg-red-500' }
  ];

  const textbooks = [
    { id: 'all', name: 'All Textbooks', subject: 'all' },
    { id: 'ncert-math-10', name: 'NCERT Mathematics Class 10', subject: 'math' },
    { id: 'ncert-math-12', name: 'NCERT Mathematics Class 12', subject: 'math' },
    { id: 'ncert-physics-11', name: 'NCERT Physics Class 11', subject: 'physics' },
    { id: 'ncert-physics-12', name: 'NCERT Physics Class 12', subject: 'physics' },
    { id: 'ncert-chemistry-11', name: 'NCERT Chemistry Class 11', subject: 'chemistry' },
    { id: 'ncert-biology-11', name: 'NCERT Biology Class 11', subject: 'biology' },
    { id: 'ncert-english-10', name: 'NCERT English Class 10', subject: 'english' }
  ];

  const quickActions = [
    { id: 'solve-problem', label: 'Solve Problem', icon: Calculator, desc: 'Get step-by-step solutions' },
    { id: 'explain-concept', label: 'Explain Concept', icon: Lightbulb, desc: 'Understand difficult topics' },
    { id: 'practice-questions', label: 'Practice Questions', icon: Target, desc: 'Generate practice problems' },
    { id: 'summarize', label: 'Summarize', icon: FileText, desc: 'Get chapter summaries' },
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() && !uploadedImage) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage.trim(),
      timestamp: Date.now(),
      subject: selectedSubject,
      textbook: selectedTextbook,
      image: uploadedImage
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setUploadedImage(null);
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = generateAIResponse(userMessage);
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1500);
  };

  const generateAIResponse = (userMessage) => {
    const responses = {
      math: {
        solve: "I'll solve this step by step:\n\n**Step 1:** Identify the given information\n**Step 2:** Apply the appropriate formula\n**Step 3:** Calculate the result\n\n*Would you like me to explain any of these steps in more detail?*",
        concept: "This mathematical concept involves understanding the relationship between variables. Let me break it down:\n\n• **Definition:** [Key concept explanation]\n• **Formula:** [Mathematical expression]\n• **Example:** [Practical application]\n\n*Try practicing with similar problems!*"
      },
      physics: {
        solve: "Let's analyze this physics problem:\n\n**Given:** [Problem parameters]\n**Find:** [What we need to calculate]\n**Solution:**\n1. Apply Newton's laws\n2. Use kinematic equations\n3. Calculate final answer\n\n*Physics is all about understanding the underlying principles!*",
        concept: "This physics concept demonstrates fundamental laws of nature:\n\n• **Principle:** [Core physics law]\n• **Real-world example:** [Practical demonstration]\n• **Mathematical representation:** [Equations]\n\n*Would you like to see some practice problems?*"
      },
      general: [
        "Great question! Let me help you understand this better. Based on your textbook content, here's a comprehensive explanation...",
        "I can see you're working on an interesting problem. Let me break this down into manageable steps...",
        "This is a common topic that students find challenging. Here's how I recommend approaching it...",
        "Excellent! This connects to several important concepts we've covered. Let me explain the relationships..."
      ]
    };

    const isQuestion = userMessage.content.includes('?') || 
                     userMessage.content.toLowerCase().includes('solve') ||
                     userMessage.content.toLowerCase().includes('explain') ||
                     userMessage.content.toLowerCase().includes('help');

    let responseContent;
    if (userMessage.subject === 'math' && isQuestion) {
      responseContent = Math.random() > 0.5 ? responses.math.solve : responses.math.concept;
    } else if (userMessage.subject === 'physics' && isQuestion) {
      responseContent = Math.random() > 0.5 ? responses.physics.solve : responses.physics.concept;
    } else {
      responseContent = responses.general[Math.floor(Math.random() * responses.general.length)];
    }

    return {
      id: Date.now().toString(),
      type: 'ai',
      content: responseContent,
      timestamp: Date.now(),
      subject: userMessage.subject,
      confidence: Math.floor(Math.random() * 20) + 80, // 80-100%
      sources: [
        `${textbooks.find(t => t.id === userMessage.textbook)?.name || 'NCERT Textbook'} - Chapter ${Math.floor(Math.random() * 15) + 1}`,
        'Reference Materials',
        'Practice Problems Database'
      ],
      suggestions: generateSuggestions(userMessage.subject)
    };
  };

  const generateSuggestions = (subject) => {
    const suggestions = {
      math: [
        "Show me more examples",
        "Practice similar problems",
        "Explain the formula derivation",
        "What's the real-world application?"
      ],
      physics: [
        "Show the experiment",
        "Explain the physics behind this",
        "Related concepts to study",
        "Practice numerical problems"
      ],
      chemistry: [
        "Show chemical equations",
        "Explain the reaction mechanism",
        "Laboratory procedures",
        "Related chemical properties"
      ],
      biology: [
        "Show diagrams",
        "Explain biological processes",
        "Related body systems",
        "Evolution connections"
      ]
    };
    return suggestions[subject] || suggestions.math;
  };

  const handleQuickAction = (action) => {
    const prompts = {
      'solve-problem': "I have a problem that I need help solving step by step.",
      'explain-concept': "Can you explain this concept in simple terms?",
      'practice-questions': "Generate some practice questions for me to solve.",
      'summarize': "Please summarize the key points of this chapter."
    };
    setCurrentMessage(prompts[action]);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage({
          file: file,
          dataURL: e.target.result,
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const startVoiceRecording = () => {
    setIsListening(true);
    // Implement speech recognition here
    setTimeout(() => {
      setIsListening(false);
      setCurrentMessage("This is a voice message converted to text");
    }, 3000);
  };

  const filteredTextbooks = textbooks.filter(t => 
    selectedSubject === 'all' || t.subject === selectedSubject || t.id === 'all'
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed right-4 bottom-4 w-96 h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50 transition-all duration-300 ${isMinimized ? 'h-16' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Study Assistant</h3>
            <p className="text-xs opacity-90">
              {isTyping ? 'Thinking...' : 'Ready to help'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onToggle}
            className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Subject and Textbook Selection */}
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedTextbook}
                onChange={(e) => setSelectedTextbook(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {filteredTextbooks.map(textbook => (
                  <option key={textbook.id} value={textbook.id}>
                    {textbook.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-1">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.id)}
                  className="flex items-center gap-2 p-2 text-xs bg-white rounded-lg hover:bg-purple-50 transition-colors border border-gray-200"
                  title={action.desc}
                >
                  <action.icon className="h-3 w-3 text-purple-600" />
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.type === 'ai' && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-xl p-3 ${
                    message.type === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}
                >
                  {message.image && (
                    <div className="mb-2">
                      <img 
                        src={message.image.dataURL} 
                        alt="Uploaded" 
                        className="max-w-full h-auto rounded-lg"
                      />
                    </div>
                  )}
                  
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  
                  {message.type === 'ai' && message.confidence && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Confidence: {message.confidence}%</span>
                        <div className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          <span>AI Generated</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {message.sources && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Sources:</span>
                        <ul className="mt-1 space-y-1">
                          {message.sources.map((source, idx) => (
                            <li key={idx} className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {source}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {message.suggestions && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-2">Suggestions:</div>
                      <div className="grid grid-cols-1 gap-1">
                        {message.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentMessage(suggestion)}
                            className="text-left text-xs p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className={`text-xs mt-2 ${message.type === 'user' ? 'text-purple-200' : 'text-gray-400'}`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                
                {message.type === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="h-2 w-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-100 p-3 bg-white">
            {uploadedImage && (
              <div className="mb-3 p-2 bg-gray-50 rounded-lg flex items-center gap-2">
                <img 
                  src={uploadedImage.dataURL} 
                  alt="Upload preview" 
                  className="h-12 w-12 object-cover rounded-lg"
                />
                <div className="flex-1 text-xs">
                  <div className="font-medium">{uploadedImage.name}</div>
                  <div className="text-gray-500">Ready to analyze</div>
                </div>
                <button
                  onClick={() => setUploadedImage(null)}
                  className="h-6 w-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            
            <div className="flex items-end gap-2">
              <div className="flex-1 border border-gray-200 rounded-xl bg-gray-50">
                <div className="flex items-center px-3 py-2 border-b border-gray-200">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="h-6 w-6 rounded-lg hover:bg-gray-200 flex items-center justify-center"
                    title="Upload image"
                  >
                    <Image className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={startVoiceRecording}
                    className={`ml-2 h-6 w-6 rounded-lg hover:bg-gray-200 flex items-center justify-center ${isListening ? 'bg-red-100 text-red-600' : ''}`}
                    title="Voice message"
                  >
                    <Mic className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask me anything about your textbooks..."
                  className="w-full px-3 py-2 bg-transparent text-sm text-white placeholder:text-slate-400 caret-white resize-none focus:outline-none min-h-[44px] max-h-24"
                  rows={1}
                />
              </div>
              
              <button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() && !uploadedImage}
                className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AITextbookChat;
