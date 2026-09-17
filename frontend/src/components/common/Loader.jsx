import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function Loader({ className = 'h-64' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center gap-3">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    </div>
  );
}