import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type InterestNotePrintDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditDays?: number;
  onConfirm: (showInterestNote: boolean) => void;
};

export function InterestNotePrintDialog({
  open,
  onOpenChange,
  creditDays = 0,
  onConfirm,
}: InterestNotePrintDialogProps) {
  const [showInterestNote, setShowInterestNote] = useState(false);

  useEffect(() => {
    if (open) {
      setShowInterestNote(false);
    }
  }, [open]);

  const preview = `Please Note : Payment After ${creditDays || 0} Days 1% Interest will Be Charged`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Interest note on bill?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Include this footer message on the sales bill?</p>
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-foreground">
                {preview}
              </p>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="show-interest-note"
                  checked={showInterestNote}
                  onCheckedChange={setShowInterestNote}
                />
                <Label htmlFor="show-interest-note" className="cursor-pointer">
                  Show interest note
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(showInterestNote)}>
            Print Bill
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
