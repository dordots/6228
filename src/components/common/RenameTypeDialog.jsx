import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';

export default function RenameTypeDialog({ open, onOpenChange, itemTypes, entityName, onRename }) {
  const [originalType, setOriginalType] = useState('');
  const [newType, setNewType] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setOriginalType('');
      setNewType('');
      setIsLoading(false);
    }
  }, [open]);

  const handleRenameClick = async () => {
    if (!originalType || !newType.trim() || originalType === newType.trim()) {
      alert("Please select an original type and provide a different new type name.");
      return;
    }
    setIsLoading(true);
    await onRename(originalType, newType.trim());
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {entityName} Type</DialogTitle>
          <DialogDescription>
            This action will rename all instances of a selected type to a new name. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="original-type">Original Type</Label>
            <Select value={originalType} onValueChange={setOriginalType}>
              <SelectTrigger id="original-type">
                <SelectValue placeholder="Select a type to rename" />
              </SelectTrigger>
              <SelectContent>
                {itemTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-type">New Type Name</Label>
            <Input
              id="new-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="Enter the new name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleRenameClick} disabled={isLoading || !originalType || !newType.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Renaming...
              </>
            ) : (
              "Rename"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}