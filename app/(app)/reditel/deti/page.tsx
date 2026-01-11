"use client";

import { useState, useEffect } from "react";
import {
  getAllChildrenWithParents,
  getAllParents,
  createChild,
  updateChild,
  toggleChildActive,
  assignParentToChild,
  removeParentFromChild,
  type ChildWithParents,
} from "@/app/actions/director";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Badge,
} from "@/components/ui";

type Parent = {
  id: string;
  name: string | null;
  email: string | null;
};

export default function ChildrenManagementPage() {
  const [children, setChildren] = useState<ChildWithParents[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New child form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit child
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Assign parent modal
  const [assigningChildId, setAssigningChildId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [isAssigningParent, setIsAssigningParent] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Loading states
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingParent, setRemovingParent] = useState<{
    parentId: string;
    childId: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [childrenData, parentsData] = await Promise.all([
        getAllChildrenWithParents(),
        getAllParents(),
      ]);
      setChildren(childrenData);
      setParents(parentsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setIsAddingChild(true);

    try {
      const newChild = await createChild(newFirstName, newLastName);
      setChildren((prev) => [
        ...prev,
        { ...newChild, parents: [] },
      ].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
      }));
      setNewFirstName("");
      setNewLastName("");
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Nepodařilo se přidat dítě"
      );
    } finally {
      setIsAddingChild(false);
    }
  };

  const handleStartEdit = (child: ChildWithParents) => {
    setEditingChildId(child.id);
    setEditFirstName(child.firstName);
    setEditLastName(child.lastName);
  };

  const handleCancelEdit = () => {
    setEditingChildId(null);
    setEditFirstName("");
    setEditLastName("");
  };

  const handleSaveEdit = async () => {
    if (!editingChildId) return;
    setIsSavingEdit(true);

    try {
      await updateChild(editingChildId, {
        firstName: editFirstName,
        lastName: editLastName,
      });
      setChildren((prev) =>
        prev
          .map((c) =>
            c.id === editingChildId
              ? { ...c, firstName: editFirstName, lastName: editLastName }
              : c
          )
          .sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
          })
      );
      handleCancelEdit();
    } catch (err) {
      console.error("Failed to update child:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleActive = async (childId: string, currentActive: boolean) => {
    setTogglingId(childId);
    try {
      await toggleChildActive(childId, !currentActive);
      setChildren((prev) =>
        prev
          .map((c) => (c.id === childId ? { ...c, active: !currentActive } : c))
          .sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
          })
      );
    } catch (err) {
      console.error("Failed to toggle child status:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenAssignModal = (childId: string) => {
    setAssigningChildId(childId);
    setSelectedParentId("");
    setAssignError("");
  };

  const handleCloseAssignModal = () => {
    setAssigningChildId(null);
    setSelectedParentId("");
    setAssignError("");
  };

  const handleAssignParent = async () => {
    if (!assigningChildId || !selectedParentId) return;
    setAssignError("");
    setIsAssigningParent(true);

    try {
      await assignParentToChild(selectedParentId, assigningChildId);
      const parent = parents.find((p) => p.id === selectedParentId);
      if (parent) {
        setChildren((prev) =>
          prev.map((c) =>
            c.id === assigningChildId
              ? { ...c, parents: [...c.parents, parent] }
              : c
          )
        );
      }
      handleCloseAssignModal();
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : "Nepodařilo se přiřadit rodiče"
      );
    } finally {
      setIsAssigningParent(false);
    }
  };

  const handleRemoveParent = async (parentId: string, childId: string) => {
    setRemovingParent({ parentId, childId });
    try {
      await removeParentFromChild(parentId, childId);
      setChildren((prev) =>
        prev.map((c) =>
          c.id === childId
            ? { ...c, parents: c.parents.filter((p) => p.id !== parentId) }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to remove parent:", err);
    } finally {
      setRemovingParent(null);
    }
  };

  // Get available parents for a specific child (those not already assigned)
  const getAvailableParents = (childId: string) => {
    const child = children.find((c) => c.id === childId);
    if (!child) return parents;
    const assignedParentIds = new Set(child.parents.map((p) => p.id));
    return parents.filter((p) => !assignedParentIds.has(p.id));
  };

  const activeChildren = children.filter((c) => c.active);
  const inactiveChildren = children.filter((c) => !c.active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Správa dětí</h1>
        <p className="text-charcoal-light">
          Přidávání nových dětí a přiřazování rodičovských účtů
        </p>
      </div>

      {/* Add new child */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Přidat nové dítě
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddChild} className="space-y-4">
            {addError && (
              <div className="p-3 bg-coral/10 border border-coral/20 rounded-lg text-coral text-sm">
                {addError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Jméno"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder="Např. Anička"
                required
              />
              <Input
                label="Příjmení"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder="Např. Nováková"
                required
              />
            </div>

            <Button type="submit" isLoading={isAddingChild}>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Přidat dítě
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Children list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-sage"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Aktivní děti ({activeChildren.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
            </div>
          ) : activeChildren.length === 0 ? (
            <p className="text-charcoal-light text-center py-8">
              Žádné aktivní děti
            </p>
          ) : (
            <div className="space-y-3">
              {activeChildren.map((child) => (
                <ChildRow
                  key={child.id}
                  child={child}
                  isEditing={editingChildId === child.id}
                  editFirstName={editFirstName}
                  editLastName={editLastName}
                  setEditFirstName={setEditFirstName}
                  setEditLastName={setEditLastName}
                  isSavingEdit={isSavingEdit}
                  togglingId={togglingId}
                  removingParent={removingParent}
                  onStartEdit={() => handleStartEdit(child)}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onToggleActive={() => handleToggleActive(child.id, child.active)}
                  onOpenAssignModal={() => handleOpenAssignModal(child.id)}
                  onRemoveParent={(parentId) => handleRemoveParent(parentId, child.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive children */}
      {inactiveChildren.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-charcoal-light">
              Neaktivní děti ({inactiveChildren.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactiveChildren.map((child) => (
                <ChildRow
                  key={child.id}
                  child={child}
                  isEditing={editingChildId === child.id}
                  editFirstName={editFirstName}
                  editLastName={editLastName}
                  setEditFirstName={setEditFirstName}
                  setEditLastName={setEditLastName}
                  isSavingEdit={isSavingEdit}
                  togglingId={togglingId}
                  removingParent={removingParent}
                  onStartEdit={() => handleStartEdit(child)}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onToggleActive={() => handleToggleActive(child.id, child.active)}
                  onOpenAssignModal={() => handleOpenAssignModal(child.id)}
                  onRemoveParent={(parentId) => handleRemoveParent(parentId, child.id)}
                  inactive
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign parent modal */}
      {assigningChildId && (
        <div className="fixed inset-0 bg-charcoal/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Přiřadit rodiče</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignError && (
                <div className="p-3 bg-coral/10 border border-coral/20 rounded-lg text-coral text-sm">
                  {assignError}
                </div>
              )}

              {(() => {
                const availableParents = getAvailableParents(assigningChildId);
                if (availableParents.length === 0) {
                  return (
                    <p className="text-charcoal-light text-center py-4">
                      Všichni rodiče jsou již přiřazeni k tomuto dítěti, nebo zatím
                      nejsou v systému žádní rodiče.
                    </p>
                  );
                }
                return (
                  <Select
                    label="Vyberte rodiče"
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    options={[
                      { value: "", label: "-- Vyberte rodiče --" },
                      ...availableParents.map((p) => ({
                        value: p.id,
                        label: `${p.name || "Bez jména"} (${p.email || "bez e-mailu"})`,
                      })),
                    ]}
                  />
                );
              })()}

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={handleCloseAssignModal}
                  disabled={isAssigningParent}
                >
                  Zrušit
                </Button>
                <Button
                  onClick={handleAssignParent}
                  isLoading={isAssigningParent}
                  disabled={!selectedParentId}
                >
                  Přiřadit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================
// Child Row Component
// ============================================

interface ChildRowProps {
  child: ChildWithParents;
  isEditing: boolean;
  editFirstName: string;
  editLastName: string;
  setEditFirstName: (value: string) => void;
  setEditLastName: (value: string) => void;
  isSavingEdit: boolean;
  togglingId: string | null;
  removingParent: { parentId: string; childId: string } | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggleActive: () => void;
  onOpenAssignModal: () => void;
  onRemoveParent: (parentId: string) => void;
  inactive?: boolean;
}

function ChildRow({
  child,
  isEditing,
  editFirstName,
  editLastName,
  setEditFirstName,
  setEditLastName,
  isSavingEdit,
  togglingId,
  removingParent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleActive,
  onOpenAssignModal,
  onRemoveParent,
  inactive,
}: ChildRowProps) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        inactive
          ? "bg-cream/50 border-cream-dark opacity-70"
          : "bg-cream border-cream-dark"
      }`}
    >
      {/* Child info and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {isEditing ? (
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <Input
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
              className="sm:w-40"
              placeholder="Jméno"
            />
            <Input
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
              className="sm:w-40"
              placeholder="Příjmení"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={onSaveEdit} isLoading={isSavingEdit}>
                Uložit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEdit}
                disabled={isSavingEdit}
              >
                Zrušit
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-charcoal">
                {child.firstName} {child.lastName}
              </p>
              {!child.active && (
                <Badge variant="default" className="text-xs">
                  Neaktivní
                </Badge>
              )}
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={onStartEdit}>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenAssignModal}>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              <span className="hidden sm:inline ml-1">Přiřadit rodiče</span>
            </Button>
            <Button
              size="sm"
              variant={child.active ? "ghost" : "outline"}
              onClick={onToggleActive}
              isLoading={togglingId === child.id}
              className={child.active ? "text-coral hover:bg-coral/10" : "text-sage"}
            >
              {child.active ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  <span className="hidden sm:inline ml-1">Deaktivovat</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="hidden sm:inline ml-1">Aktivovat</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Parents list */}
      <div className="mt-3 pt-3 border-t border-cream-dark">
        <p className="text-xs text-charcoal-light uppercase tracking-wide mb-2">
          Přiřazení rodiče:
        </p>
        {child.parents.length === 0 ? (
          <p className="text-sm text-charcoal-light italic">
            Žádní přiřazení rodiče
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {child.parents.map((parent) => (
              <div
                key={parent.id}
                className="flex items-center gap-1 bg-sage/10 px-2 py-1 rounded-md text-sm"
              >
                <span className="text-charcoal">
                  {parent.name || parent.email || "Neznámý rodič"}
                </span>
                <button
                  onClick={() => onRemoveParent(parent.id)}
                  disabled={
                    removingParent?.parentId === parent.id &&
                    removingParent?.childId === child.id
                  }
                  className="text-charcoal-light hover:text-coral transition-colors p-0.5"
                  title="Odebrat rodiče"
                >
                  {removingParent?.parentId === parent.id &&
                  removingParent?.childId === child.id ? (
                    <div className="w-3 h-3 border-2 border-coral border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
