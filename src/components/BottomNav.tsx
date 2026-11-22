import React from 'react';
import { LayoutDashboard, Users, GraduationCap, BookOpenCheck, Award, MoreHorizontal } from 'lucide-react';
import { TabType } from './Sidebar';
import { Language, translations } from '../utils/translations';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  language: Language;
  onOpenMoreMenu: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  language,
  onOpenMoreMenu,
}) => {
  const t = translations[language];

  const primaryItems = [
    { id: 'dashboard' as TabType, label: t.dashboard || 'Dashboard', icon: LayoutDashboard },
    { id: 'students' as TabType, label: t.students || 'Students', icon: Users },
    { id: 'classes' as TabType, label: language === 'ur' ? 'جماعتیں' : 'Classes', icon: GraduationCap },
    { id: 'marks-entry' as TabType, label: language === 'ur' ? 'نمبرات' : 'Marks', icon: BookOpenCheck },
    { id: 'progress-cards' as TabType, label: language === 'ur' ? 'کارڈز' : 'HPC Cards', icon: Award },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around z-30 shadow-lg no-print">
      {primaryItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              isActive ? 'text-indigo-600 font-bold scale-105' : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label.split(' ')[0]}</span>
          </button>
        );
      })}

      {/* More button */}
      <button
        onClick={onOpenMoreMenu}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-500 hover:text-slate-900"
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight">
          {language === 'ur' ? 'مزید' : 'More'}
        </span>
      </button>
    </div>
  );
};
