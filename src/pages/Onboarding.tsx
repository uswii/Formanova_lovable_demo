import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  type UserType,
  isOnboardingComplete,
  markOnboardingComplete,
  saveUserType,
} from '@/lib/onboarding-api';

// ---------------------------------------------------------------------------
// Role options
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: UserType; label: string; icon: string }[] = [
  { value: 'jewelry_brand',      label: 'Jewelry Brand',       icon: '/jewelry-brand.svg' },
  { value: 'freelancer',         label: 'Freelancer',          icon: '/freelancer.svg' },
  { value: 'researcher_student', label: 'Researcher / Student', icon: '/ai_researcher_illustration.svg' },
  { value: 'content_creator',    label: 'Content Creator',     icon: '/content_creator.svg' },
];

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface RoleCardProps {
  value: UserType;
  label: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
}

function RoleCard({ label, icon, selected, onSelect }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative flex aspect-square w-full flex-col items-center justify-center gap-2 sm:gap-3',
        'rounded-xl border-2 p-3 sm:p-5',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'border-primary bg-primary/5 scale-[1.02] shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/20',
      )}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
        </span>
      )}
      <img
        src={icon}
        alt=""
        draggable={false}
        className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
      />
      <span className={cn(
        'text-center text-xs font-medium leading-tight sm:text-sm',
        selected ? 'text-foreground' : 'text-muted-foreground',
      )}>
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Onboarding() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<UserType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initializing) return;
    if (user && isOnboardingComplete(user.id)) {
      navigate('/studio', { replace: true });
    }
  }, [user, initializing, navigate]);

  const handleContinue = async () => {
    if (!selected || !user || submitting) return;
    setSubmitting(true);
    try {
      await saveUserType(selected);
    } catch {
      // Backend endpoint may not exist yet — proceed with local storage only
    }
    markOnboardingComplete(user.id);
    navigate('/studio', { replace: true });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-6 sm:py-10">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="font-display text-4xl leading-tight tracking-wide sm:text-5xl">
          What best describes you?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Help us personalize your Formanova experience
        </p>
      </div>

      <div className="grid w-full max-w-[480px] grid-cols-2 gap-4 sm:gap-6">
        {ROLE_OPTIONS.map((option) => (
          <RoleCard
            key={option.value}
            {...option}
            selected={selected === option.value}
            onSelect={() => setSelected(option.value)}
          />
        ))}
      </div>

      <Button
        className="mt-6 min-w-[160px] px-8 sm:mt-8 sm:px-10"
        size="lg"
        disabled={!selected || submitting}
        onClick={handleContinue}
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continue
        {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}
