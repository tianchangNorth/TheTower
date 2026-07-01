"use client";

import { useConfirmStore } from "@/stores/confirmStore";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** 全局确认弹窗 Provider：在 root layout 挂载一次，订阅 confirmStore。 */
export function ConfirmDialogProvider() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const close = useConfirmStore((s) => s.close);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          {options?.description ? (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" size="sm" onClick={() => close(false)}>
            {options?.cancelLabel ?? "取消"}
          </Button>
          <Button
            variant={options?.danger ? "danger" : "solid"}
            size="sm"
            onClick={() => close(true)}
          >
            {options?.confirmLabel ?? "确认"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
