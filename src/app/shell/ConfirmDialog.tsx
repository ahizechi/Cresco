import { closeDialog, type ConfirmOptions } from "../core/state";
import { Btn } from "../ui/controls";
import { Dialog } from "../ui/layout";

export function ConfirmDialog({
  title,
  text,
  ok = "Confirm",
  danger,
  f,
}: ConfirmOptions) {
  return (
    <Dialog
      title={title}
      desc={text}
      foot={
        <>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn
            v={danger ? "danger" : "primary"}
            onClick={() => {
              closeDialog();
              f();
            }}
          >
            {ok}
          </Btn>
        </>
      }
    />
  );
}
