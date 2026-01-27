import { motion } from 'framer-motion';
import { User, Users } from 'lucide-react';

export type SkinTone = 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';
export type Gender = 'female' | 'male';

interface MetadataSelectorsProps {
  skinTone: SkinTone;
  gender: Gender;
  onSkinToneChange: (tone: SkinTone) => void;
  onGenderChange: (gender: Gender) => void;
  disabled?: boolean;
}

const SKIN_TONES: { id: SkinTone; color: string; label: string }[] = [
  { id: 'light', color: '#FFE0BD', label: 'Light' },
  { id: 'medium-light', color: '#E5C298', label: 'Medium Light' },
  { id: 'medium', color: '#C8A27C', label: 'Medium' },
  { id: 'medium-dark', color: '#A67C52', label: 'Medium Dark' },
  { id: 'dark', color: '#6B4423', label: 'Dark' },
];

const MetadataSelectors = ({
  skinTone,
  gender,
  onSkinToneChange,
  onGenderChange,
  disabled = false,
}: MetadataSelectorsProps) => {
  return (
    <div className="space-y-5">
      {/* Skin Tone Selector */}
      <div className="space-y-2">
        <span className="marta-label text-muted-foreground text-xs">Model Skin Tone</span>
        <div className="flex items-center gap-2">
          {SKIN_TONES.map((tone) => {
            const isSelected = skinTone === tone.id;
            return (
              <button
                key={tone.id}
                onClick={() => !disabled && onSkinToneChange(tone.id)}
                disabled={disabled}
                title={tone.label}
                className={`relative w-8 h-8 rounded-full transition-all duration-200 ${
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'
                }`}
                style={{ backgroundColor: tone.color }}
              >
                {isSelected && (
                  <motion.div
                    layoutId="skin-tone-ring"
                    className="absolute inset-[-3px] rounded-full border-2 border-formanova-hero-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gender Selector */}
      <div className="space-y-2">
        <span className="marta-label text-muted-foreground text-xs">Model Gender</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => !disabled && onGenderChange('female')}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2 marta-frame transition-all duration-200 ${
              gender === 'female'
                ? 'border-formanova-hero-accent bg-formanova-hero-accent/10 text-foreground'
                : 'text-muted-foreground hover:border-foreground/30'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <User className="w-4 h-4" />
            <span className="text-xs font-mono uppercase tracking-wide">Female</span>
          </button>
          <button
            onClick={() => !disabled && onGenderChange('male')}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2 marta-frame transition-all duration-200 ${
              gender === 'male'
                ? 'border-formanova-hero-accent bg-formanova-hero-accent/10 text-foreground'
                : 'text-muted-foreground hover:border-foreground/30'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Users className="w-4 h-4" />
            <span className="text-xs font-mono uppercase tracking-wide">Male</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MetadataSelectors;
