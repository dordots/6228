import React, { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  itemType = "item",
  itemName = "",
  isLoading = false,
  requireCode = true,
  confirmationCode = "8520",
}) {
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState("");

  // Reset input when dialog opens/closes
  useEffect(() => {
    if (open) {
      setInputCode("");
      setError("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (requireCode && inputCode !== confirmationCode) {
      setError(`Please enter the confirmation code to confirm deletion`);
      return;
    }
    setError("");
    onConfirm();
  };

  const isConfirmDisabled = isLoading || (requireCode && inputCode !== confirmationCode);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Delete {itemType}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {itemName ? (
              <strong>{itemName}</strong>
            ) : (
              `this ${itemType}`
            )}?
            <br />
            <br />
            <strong className="text-red-600">This action cannot be undone.</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireCode && (
          <div className="space-y-2">
            <Label htmlFor="confirmation-code">
              Enter the confirmation code to confirm:
            </Label>
            <Input
              id="confirmation-code"
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value);
                setError("");
              }}
              placeholder="Enter confirmation code"
              disabled={isLoading}
              autoComplete="off"
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
