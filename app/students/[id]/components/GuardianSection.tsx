'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Link2,
  Star,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { StudentGuardianLink, Guardian } from '@/src/types/guardian';
import {
  getStudentGuardiansAction,
  setPrimaryGuardianAction,
} from '@/app/actions/guardians';
import GuardianFormModal from './GuardianFormModal';
import LinkExistingGuardianModal from './LinkExistingGuardianModal';
import UnlinkGuardianModal from './UnlinkGuardianModal';

interface GuardianSectionProps {
  studentId: string;
  studentName: string;
}

export default function GuardianSection({
  studentId,
  studentName,
}: GuardianSectionProps) {
  const [links, setLinks] = useState<StudentGuardianLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [selectedGuardianForEdit, setSelectedGuardianForEdit] = useState<Guardian | null>(null);

  const [isLinkExistingOpen, setIsLinkExistingOpen] = useState(false);

  const [isUnlinkOpen, setIsUnlinkOpen] = useState(false);
  const [selectedLinkForUnlink, setSelectedLinkForUnlink] = useState<StudentGuardianLink | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchGuardians = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getStudentGuardiansAction(studentId);
      if (res.success && res.data) {
        setLinks(res.data);
      } else {
        setErrorMessage(res.error || 'Failed to load guardians.');
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error loading guardian records.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchGuardians();
  }, [fetchGuardians]);

  async function handleSetPrimary(guardianId: string) {
    setActionLoadingId(guardianId);
    try {
      const res = await setPrimaryGuardianAction(studentId, guardianId);
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to update primary contact.');
      } else {
        fetchGuardians();
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error setting primary contact.'
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  function handleOpenAdd() {
    setSelectedGuardianForEdit(null);
    setFormMode('add');
    setIsFormOpen(true);
  }

  function handleOpenEdit(guardian: Guardian) {
    setSelectedGuardianForEdit(guardian);
    setFormMode('edit');
    setIsFormOpen(true);
  }

  function handleOpenUnlink(link: StudentGuardianLink) {
    setSelectedLinkForUnlink(link);
    setIsUnlinkOpen(true);
  }

  const linkedGuardianIds = links.map((l) => l.guardian_id);

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E5E5] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#171717]" />
            <h2 className="text-base font-semibold text-[#171717]">
              Guardians & Emergency Contacts
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#737373]">
            Authorized family members, primary contacts, and emergency reach points.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsLinkExistingOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
          >
            <Link2 size={13} />
            <span>Link Existing</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-md border border-[#171717] bg-[#171717] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
          >
            <Plus size={13} />
            <span>Add Guardian</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-[#171717] bg-[#F7F7F7] p-3 text-xs text-[#171717]">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#171717]" />
          <span className="flex-1">{errorMessage}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-10 text-center flex items-center justify-center gap-2 text-xs text-[#737373]">
          <Loader2 size={15} className="animate-spin" />
          <span>Loading guardian contacts...</span>
        </div>
      ) : links.length === 0 ? (
        /* Empty state */
        <div className="py-12 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F7F7] text-[#737373] mb-3">
            <Users size={18} />
          </div>
          <p className="text-xs font-semibold text-[#171717]">
            No guardians linked yet
          </p>
          <p className="mt-1 text-xs text-[#737373] max-w-sm mx-auto">
            Link an existing family contact or add a new guardian profile for {studentName}.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setIsLinkExistingOpen(true)}
              className="rounded-md border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F7F7F7] transition-colors"
            >
              Link Existing
            </button>
            <button
              onClick={handleOpenAdd}
              className="rounded-md bg-[#111111] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#262626] transition-colors"
            >
              + Add Guardian
            </button>
          </div>
        </div>
      ) : (
        /* Guardian Cards Grid */
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map((link) => {
            const g = link.guardians;
            if (!g) return null;

            const isSettingPrimary = actionLoadingId === link.guardian_id;

            return (
              <div
                key={link.guardian_id}
                className={`rounded-lg border p-4 transition-colors space-y-3 ${
                  link.is_primary
                    ? 'border-[#171717] bg-[#FAFAFA]'
                    : 'border-[#E5E5E5] bg-white'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#171717]">
                        {g.full_name}
                      </h3>
                      {link.is_primary && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#171717] bg-[#171717] px-2 py-0.5 text-[10px] font-medium text-white">
                          <Star size={10} className="fill-white" />
                          <span>Primary</span>
                        </span>
                      )}
                    </div>
                    <span className="inline-block mt-1 text-[11px] font-medium text-[#737373] bg-[#F7F7F7] border border-[#E5E5E5] px-2 py-0.5 rounded">
                      {g.relationship || 'Guardian'}
                    </span>
                  </div>

                  {/* Top action: edit */}
                  <button
                    onClick={() => handleOpenEdit(g)}
                    className="rounded p-1 text-[#737373] hover:text-[#171717] hover:bg-[#EFEFEF] transition-colors"
                    title="Edit Guardian"
                    aria-label={`Edit ${g.full_name}`}
                  >
                    <Edit2 size={13} />
                  </button>
                </div>

                {/* Contact details */}
                <div className="space-y-1.5 text-xs text-[#737373] border-t border-b border-[#F0F0F0] py-2.5">
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="shrink-0 text-[#A3A3A3]" />
                    <span className="text-[#171717] font-medium">
                      {g.phone || 'No phone provided'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="shrink-0 text-[#A3A3A3]" />
                    <span className="text-[#171717] break-all">
                      {g.email || 'No email provided'}
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-1">
                  {!link.is_primary ? (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(link.guardian_id)}
                      disabled={isSettingPrimary}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#737373] hover:text-[#171717] transition-colors disabled:opacity-50"
                    >
                      {isSettingPrimary ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Star size={11} />
                      )}
                      <span>Set as Primary Contact</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#737373]">
                      Designated primary contact
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenUnlink(link)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#737373] hover:text-[#171717] transition-colors p-1"
                    title="Remove Guardian Relationship"
                  >
                    <Trash2 size={12} />
                    <span>Unlink</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Guardian Modal */}
      <GuardianFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={fetchGuardians}
        studentId={studentId}
        initialData={selectedGuardianForEdit}
        mode={formMode}
      />

      {/* Link Existing Guardian Modal */}
      <LinkExistingGuardianModal
        isOpen={isLinkExistingOpen}
        onClose={() => setIsLinkExistingOpen(false)}
        onSuccess={fetchGuardians}
        studentId={studentId}
        alreadyLinkedGuardianIds={linkedGuardianIds}
      />

      {/* Unlink Confirmation Modal */}
      <UnlinkGuardianModal
        isOpen={isUnlinkOpen}
        onClose={() => setIsUnlinkOpen(false)}
        onSuccess={fetchGuardians}
        studentId={studentId}
        studentName={studentName}
        link={selectedLinkForUnlink}
      />
    </div>
  );
}
