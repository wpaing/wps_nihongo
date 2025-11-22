
import React, { useEffect, useState } from 'react';
import { Trophy, Footprints, BookOpen, Library, BrainCircuit, Flame, Star } from 'lucide-react';
import { Achievement } from '../types';

interface AchievementToastProps {
  achievement?: Achievement;
  onClose: () => void;
}

// Map icon strings to components
const IconMap: Record<string, any> = {
  Footprints, BookOpen, Library, BrainCircuit, Flame, Trophy, Star
};

const AchievementToast: React.FC<AchievementToastProps> = ({ achievement, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!achievement) return null;

  const IconComponent = IconMap[achievement.icon] || Star;

  return (
    <div className={`
      fixed top-20 right-4 z-50 transition-all duration-500 transform
      ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
    `}>
      <div className="bg-white border-l-4 border-yellow-400 rounded-lg shadow-xl p-4 flex items-center gap-4 max-w-sm">
        <div className="bg-yellow-100 p-3 rounded-full text-yellow-600 shrink-0 animate-bounce">
          <IconComponent size={24} />
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
            Achievement Unlocked!
          </h4>
          <p className="text-slate-600 font-bold text-lg">
            {achievement.title}
          </p>
          <p className="text-xs text-slate-500">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
};

export default AchievementToast;
