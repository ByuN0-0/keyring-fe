"use client";

import { Secret } from "@/types";
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

interface SecretDeleteDialogProps {
  secret: Secret | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (secret: Secret) => void;
}

export function SecretDeleteDialog({
  secret,
  onOpenChange,
  onConfirm,
}: SecretDeleteDialogProps) {
  return (
    <AlertDialog open={Boolean(secret)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>시크릿 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            {secret?.name} 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              if (secret) onConfirm(secret);
            }}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
