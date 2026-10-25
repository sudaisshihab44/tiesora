import React, { useState } from 'react';
import { Family, FamilyPerson, Relationship, Memory, FamilyEvent } from '../../types';
import { answerFamilyQuestion, AssistantAnswer } from '../../utils/aiAssistant';
import { 
  Sparkles, 
  Send, 
  X, 
  Compass, 
  User, 
  Bot, 
  ArrowRight, 
  CheckCircle2, 
  BookOpen 
} from 'lucide-react';

interface FamilyAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: FamilyPerson[];
  relationships: Relationship[];
  memories: Memory[];
  events: FamilyEvent[];
  family: Family;
  onSelectPerson: (person: FamilyPerson) => void;
  onExploreRelationship: (person: FamilyPerson) => void;
  onNavigate: (tab: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citedPeople?: FamilyPerson[];
  action?: AssistantAnswer['suggestedAction'];
}

export const FamilyAssistantModal: React.FC<FamilyAssistantModalProps> = ({
  isOpen,
  onClose,
  people,
  relationships,
  memories,
  events,
  family,
  onSelectPerson,
  onExploreRelationship,
  onNavigate,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm_welcome',
      sender: 'assistant',
      text: `Hello! I’m your Tiesora Heritage Assistant. I can calculate exact family relationships, summarize relative profiles, and trace ancestral branches grounded strictly in your **${family.name}** records.`,
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const quickQuestions = [
    'How is Thomas Montgomery related to Julian Chen?',
    'Summarize Eleanor Ward Vance’s history',
    'Who is recorded in Generation 1?',
    'How is Leo Montgomery related to Helena Rostova?',
  ];

  const handleSend = (textToSend?: string) => {
    const q = textToSend || inputQuery;
    if (!q.trim()) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: q.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    setTimeout(() => {
      const answer = answerFamilyQuestion(q, people, relationships, memories, events, family);
      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        sender: 'assistant',
        text: answer.text,
        citedPeople: answer.citedPeople,
        action: answer.suggestedAction,
      };
      setMessages(prev => [...prev, botMsg]);
      setIsLoading(false);
    }, 300);
  };

  const handleActionClick = (action: AssistantAnswer['suggestedAction']) => {
    if (!action) return;
    onClose();
    if (action.type === 'explore_relationship' && action.personId) {
      const p = people.find(x => x.id === action.personId);
      if (p) onExploreRelationship(p);
    } else if (action.type === 'view_person' && action.personId) {
      const p = people.find(x => x.id === action.personId);
      if (p) onSelectPerson(p);
    } else if (action.type === 'open_tree') {
      onNavigate('tree');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-stone-200 shadow-2xl max-w-xl w-full flex flex-col overflow-hidden sm:my-8 animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-150" style={{ height: '85vh', maxHeight: '600px' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800 text-white rounded-xl shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Tiesora Heritage Inquiries</h3>
              <p className="text-[11px] text-stone-500">Grounded solely in verified family records</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 space-y-2 leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-emerald-800 text-white'
                    : 'bg-stone-50 border border-stone-200 text-stone-800'
                }`}
              >
                <div className="whitespace-pre-line">
                  {msg.text}
                </div>

                {/* Cited Relatives */}
                {msg.citedPeople && msg.citedPeople.length > 0 && (
                  <div className="pt-2 border-t border-stone-200/80 mt-2 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-stone-400 font-semibold block w-full">
                      Referenced family records:
                    </span>
                    {msg.citedPeople.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onClose();
                          onSelectPerson(p);
                        }}
                        className="px-2 py-0.5 bg-white border border-stone-200 hover:border-emerald-700 rounded-md text-[10px] text-stone-700 font-medium transition-colors"
                      >
                        {p.display_name} (Gen {p.generation_level})
                      </button>
                    ))}
                  </div>
                )}

                {/* Interactive Action Button */}
                {msg.action && (
                  <button
                    onClick={() => handleActionClick(msg.action)}
                    className="mt-2 px-3 py-1.5 bg-emerald-800 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-900 transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <span>Launch in Platform</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-stone-400 text-xs italic">
              <Bot className="w-4 h-4" />
              <span>Analyzing family graph records...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-6 py-2 border-t border-stone-100 bg-stone-50/50 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-stone-400 shrink-0 font-medium">Suggestions:</span>
          {quickQuestions.map(q => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-stone-700 hover:text-emerald-900 border border-stone-200 rounded-lg whitespace-nowrap transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 border-t border-stone-200 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask anything about your family tree or relationships..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-stone-300 rounded-xl outline-none focus:border-emerald-700 text-xs"
          />
          <button
            type="submit"
            className="p-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl transition-colors shrink-0 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
