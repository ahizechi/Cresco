import { desktop } from "../../platform";
import { useUpdates, checkNow, installUpdate } from "../../updates/controller";
import { Panel } from "../ui/layout";
import { Btn } from "../ui/controls";
import pkg from "../../../package.json";
export function UpdatePanel() {
  const update = useUpdates();
  return (
    <Panel title={"App updates ? " + pkg.version}>
      <div className="cresco-update">
        <p role="status" aria-live="polite">
          {desktop
            ? update.message
            : "Updates are available in the installed Windows app."}
        </p>
        {update.state === "installing" && (
          <>
            <progress
              value={update.progress || undefined}
              max={100}
              aria-label="Update download"
            />
            <span>
              {update.progress
                ? update.progress + "%"
                : "Downloading and verifying signature?"}
            </span>
          </>
        )}
        <div>
          <Btn
            disabled={
              !desktop ||
              update.state === "checking" ||
              update.state === "installing"
            }
            onClick={() => void checkNow()}
          >
            {update.state === "checking" ? "Checking?" : "Check for updates"}
          </Btn>{" "}
          {update.state === "available" && (
            <Btn v="primary" onClick={() => void installUpdate()}>
              Install update and restart
            </Btn>
          )}
        </div>
      </div>
    </Panel>
  );
}
