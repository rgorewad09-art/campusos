'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { Guardian, GuardianFormData } from '@/src/types/guardian';
import { addGuardianAction, updateGuardianAction } from '@/app/actions/guardians';

interface GuardianFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  initialData?: Guardian | null;
  mode: 'add' | 'edit';
}

const commonRelationships = [
  'Mother',
  'Father',
  'Guardian',
  'Grandparent',
  'Sibling',
  'Aunt / Uncle',
  'Other',
];

export default function GuardianFormModal({
  isOpen,
  onClose,
  onSuccess,
  studentId,
  initialData,
  mode,
}: GuardianFormModalProps) {
  const isEdit = mode === 'edit';

  const [formData, setFormData] = useState<GuardianFormData>({
    full_name: '',
    relationship: 'Mother',
    email: '',
    phone: '',
    is_primary: false,
  });

  const [customRelationship, setCustomRelationship] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData && isEdit) {
      const rel = initialData.relationship || 'Guardian';
      const isCustom = !commonRelationships.includes(rel);
      setCustomRelationship(isCustom);
      setFormData({
        full_name: initialData.full_name || '',
        relationship: rel,
        email: initialData.email || '',
        phone: initialData.phone || '',
        is_primary: false,
      });
    } else {
      setCustomRelationship(false);
      setFormData({
        full_name: '',
        relationship: 'Mother',
        email: '',
        phone: '',
        is_primary: false,
      });
    }
    setErrors({});
    setGeneralError(null);
  }, [initialData, isEdit, isOpen]);

  if (!isOpen) return null;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Guardian full name is required.';
    }
    if (!formData.relationship.trim()) {
      newErrors.relationship = 'Relationship is required.';
    }
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEdit && initialData) {
        const res = await updateGuardianAction(initialData.id, formData);
        if (!res.success) {
          setGeneralError(res.error || 'Failed to update guardian.');
        } else {
          onSuccess();
          onClose();
        }
      } else {
        const res = await addGuardianAction(studentId, formData);
        if (!res.success) {
          setGeneralError(res.error || 'Failed to add guardian.');
        } else {
          onSuccess();
          onClose();
        }
      }
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guardian-modal-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
          <div>
            <h2 id="guardian-modal-title" className="text-base font-semibold text-[#171717]">
              {isEdit ? 'Edit Guardian Details' : 'Add Guardian / Contact'}
            </h2>
            <p className="text-xs text-[#737373] mt-0.5">
              {isEdit ? 'Update existing guardian contact information.' : 'Link a new guardian to this student profile.'}
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {generalError && (
            <div className="flex items-start gap-2 rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
              <span className="flex-1">{generalError}</span>
            </div>
          )}

          <div>
            <label htmlFor="guardian_full_name" className="block text-xs font-medium text-[#171717] mb-1">
              Full Name <span className="text-[#171717] font-bold">*</span>
            </label>
            <input
              id="guardian_full_name"
              type="text"
              required
              placeholder="e.g. Priya Sharma"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors ${
                errors.full_name ? 'border-[#171717]' : 'border-[#E5E5E5]'
              }`}
            />
            {errors.full_name && (
              <p className="mt-1 text-[11px] text-[#171717]">{errors.full_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="guardian_relationship" className="block text-xs font-medium text-[#171717] mb-1">
              Relationship to Student <span className="text-[#171717] font-bold">*</span>
            </label>
            {!customRelationship ? (
              <div className="space-y-2">
                <select
                  id="guardian_relationship"
                  value={formData.relationship}
                  onChange={(e) => {
                    if (e.target.value === 'Other') {
                      setCustomRelationship(true);
                      setFormData({ ...formData, relationship: '' });
                    } else {
                      setFormData({ ...formData, relationship: e.target.value });
                    }
                  }}
                  className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
                >
                  {commonRelationships.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Specify relationship (e.g. Foster Parent)"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] focus:border-[#171717] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomRelationship(false);
                    setFormData({ ...formData, relationship: 'Mother' });
                  }}
                  className="text-[11px] text-[#737373] hover:text-[#171717] underline"
                >
                  Choose from common options
                </button>
              </div>
            )}
            {errors.relationship && (
              <p className="mt-1 text-[11px] text-[#171717]">{errors.relationship}</p>
            )}
          </div>

          <div>
            <label htmlFor="guardian_phone" className="block text-xs font-medium text-[#737373] mb-1">
              Phone Number (Optional)
            </label>
            <input
              id="guardian_phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="guardian_email" className="block text-xs font-medium text-[#737373] mb-1">
              Email Address (Optional)
            </label>
            <input
              id="guardian_email"
              type="email"
              placeholder="guardian@example.com"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full rounded-md border bg-white px-3 py-2 text-xs text-[#171717] placeholder:text-[#A3A3A3] focus:border-[#171717] focus:outline-none transition-colors ${
                errors.email ? 'border-[#171717]' : 'border-[#E5E5E5]'
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-[11px] text-[#171717]">{errors.email}</p>
            )}
          </div>

          {!isEdit && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_primary)}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="rounded border-[#E5E5E5] text-[#171717] focus:ring-0 focus:outline-none h-4 w-4"
                />
                <span className="text-xs text-[#171717] font-medium">
                  Designate as Primary Contact for this student
                </span>
              </label>
            </div>
          )}

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
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-4 py-2 text-xs font-medium text-white hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>{isEdit ? 'Saving...' : 'Adding...'}</span>
                </>
              ) : (
                <span>{isEdit ? 'Save Changes' : 'Add Guardian'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
