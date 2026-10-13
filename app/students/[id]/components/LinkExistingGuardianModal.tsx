'use client';

import { useState, useEffect } from 'react';
import { X, Search, Loader2, Link2, Check, AlertCircle, User } from 'lucide-react';
import type { Guardian } from '@/src/types/guardian';
import { searchGuardiansAction, linkExistingGuardianAction } from '@/app/actions/guardians';

interface LinkExistingGuardianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  alreadyLinkedGuardianIds: string[];
}

export default function LinkExistingGuardianModal({
  isOpen,
  onClose,
  onSuccess,
  studentId,
  alreadyLinkedGuardianIds,
}: LinkExistingGuardianModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedGuardian(null);
      setIsPrimary(false);
      setErrorMessage(null);
      setSearchQuery('');
      handleSearch('');
    }
  }, [isOpen]);

  async function handleSearch(query: string) {
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const res = await searchGuardiansAction(query);
      if (res.success && res.guardians) {
        setGuardians(res.guardians);
      } else {
        setErrorMessage(res.error || 'Failed to search guardians.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleLink() {
    if (!selectedGuardian) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await linkExistingGuardianAction(
        studentId,
        selectedGuardian.id,
        isPrimary
      );
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to link guardian.');
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-guardian-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div>
            <h2 id="link-guardian-title" className="text-base font-semibold text-[#171717]">
              Link Existing Guardian
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Select an already registered guardian to link to this student.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#737373] hover:text-[#171717] transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Search input */}
        <div className="mt-4 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />
          <input
            type="text"
            placeholder="Search by guardian name, phone, or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            className="w-full rounded-md border border-[#E5E5E5] bg-white py-1.5 pl-9 pr-3 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors"
          />
        </div>

        {/* Guardian list */}
        <div className="mt-3 divide-y divide-[#E5E5E5] border border-[#E5E5E5] rounded-md max-h-52 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-xs text-[#737373] flex items-center justify-center gap-2">
              <Loader2 size={13} className="animate-spin" />
              <span>Searching directory...</span>
            </div>
          ) : guardians.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#737373]">
              No guardians found. Create a new guardian instead.
            </div>
          ) : (
            guardians.map((g) => {
              const isAlreadyLinked = alreadyLinkedGuardianIds.includes(g.id);
              const isSelected = selectedGuardian?.id === g.id;

              return (
                <div
                  key={g.id}
                  onClick={() => {
                    if (!isAlreadyLinked) {
                      setSelectedGuardian(g);
                    }
                  }}
                  className={`p-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isAlreadyLinked
                      ? 'bg-[#FAFAFA] opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'bg-[#F0F0F0] border-l-2 border-[#171717]'
                      : 'hover:bg-[#F7F7F7]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#171717] text-[10px] font-semibold text-white">
                      {g.full_name?.[0]?.toUpperCase() || <User size={12} />}
                    </div>
                    <div>
                      <p className="font-medium text-[#171717]">{g.full_name}</p>
                      <p className="text-[11px] text-[#737373]">
                        {g.relationship || 'Guardian'} {g.phone ? `• ${g.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isAlreadyLinked ? (
                      <span className="text-[10px] text-[#737373] font-medium bg-[#E5E5E5] px-1.5 py-0.5 rounded">
                        Already linked
                      </span>
                    ) : isSelected ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#171717] text-white">
                        <Check size={11} />
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#737373]">Select</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Guardian info & Primary checkbox */}
        {selectedGuardian && (
          <div className="mt-4 rounded-md border border-[#E5E5E5] bg-[#F7F7F7] p-3 text-xs space-y-2">
            <p className="font-semibold text-[#171717]">
              Selected: {selectedGuardian.full_name}
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded border-[#E5E5E5] text-[#171717] focus:ring-0 focus:outline-none h-4 w-4"
              />
              <span className="text-xs text-[#171717] font-medium">
                Designate as Primary Contact for this student
              </span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[#E5E5E5] pt-4 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={isSubmitting || !selectedGuardian}
            className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Linking...</span>
              </>
            ) : (
              <>
                <Link2 size={13} />
                <span>Link Guardian</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
