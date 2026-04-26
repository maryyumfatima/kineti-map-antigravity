import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface AISOAPNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftData: {
    id: string;
    booking_id: string;
    clinic_id: string;
    patient_id: string;
    draft_subjective: string;
    draft_objective: string;
    draft_assessment: string;
    draft_plan: string;
  } | null;
  onSaved?: () => void;
}

export function AISOAPNoteModal({ isOpen, onClose, draftData, onSaved }: AISOAPNoteModalProps) {
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draftData) {
      setSubjective(draftData.draft_subjective || "");
      setObjective(draftData.draft_objective || "");
      setAssessment(draftData.draft_assessment || "");
      setPlan(draftData.draft_plan || "");
    }
  }, [draftData]);

  const handleSave = async () => {
    if (!draftData) return;
    setSaving(true);
    try {
      // 1. Save to soap_notes
      const { error: saveError } = await supabase.from("soap_notes").insert({
        booking_id: draftData.booking_id,
        clinic_id: draftData.clinic_id,
        patient_id: draftData.patient_id,
        subjective,
        objective,
        assessment,
        plan,
        is_ai_generated: true,
      });

      if (saveError) throw saveError;

      // 2. Mark draft as accepted
      const { error: updateError } = await supabase
        .from("ai_soap_drafts")
        .update({ accepted: true })
        .eq("id", draftData.id);

      if (updateError) throw updateError;

      toast.success("SOAP note saved successfully!");
      onSaved?.();
      onClose();
    } catch (error) {
      console.error("Error saving SOAP note:", error);
      toast.error("Failed to save SOAP note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="bg-[#006D77] p-6 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent animate-pulse" />
            <DialogTitle className="font-display text-2xl font-bold">AI SOAP Note Draft</DialogTitle>
          </div>
          <DialogDescription className="text-white/80 font-medium">
            Review and edit the AI-generated clinical notes before saving to the patient record.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="subjective" className="text-[#006D77] font-bold uppercase tracking-wider text-xs">
                Subjective
              </Label>
              <Textarea
                id="subjective"
                value={subjective}
                onChange={(e) => setSubjective(e.target.value)}
                placeholder="Patient's report of symptoms..."
                className="min-h-[100px] focus-visible:ring-[#006D77] border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective" className="text-[#006D77] font-bold uppercase tracking-wider text-xs">
                Objective
              </Label>
              <Textarea
                id="objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Clinical observations and tests..."
                className="min-h-[100px] focus-visible:ring-[#006D77] border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment" className="text-[#006D77] font-bold uppercase tracking-wider text-xs">
                Assessment
              </Label>
              <Textarea
                id="assessment"
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                placeholder="Professional analysis and diagnosis..."
                className="min-h-[100px] focus-visible:ring-[#006D77] border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan" className="text-[#006D77] font-bold uppercase tracking-wider text-xs">
                Plan
              </Label>
              <Textarea
                id="plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Treatment plan and next steps..."
                className="min-h-[100px] focus-visible:ring-[#006D77] border-slate-200"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <Button variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-700">
            Skip for now
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-[#006D77] hover:bg-[#005a63] text-white px-8 font-semibold shadow-lg shadow-[#006D77]/20"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save SOAP Note"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
