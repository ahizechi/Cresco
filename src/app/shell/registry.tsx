import type { ComponentProps } from "react";
import { HabitDialog } from "../habits/HabitDialog";
import { HabitDayDialog, HabitPauseDialog } from "../habits/HabitDayDialogs";
import {
  RoutineDialog,
  RoutineHistorySheet,
  RoutineArchiveSheet,
} from "../habits/Routines";
import { StreakRulesSheet } from "../habits/HabitAll";
import { TxnDialog } from "../finance/TxnDialog";
import {
  AccountDialog,
  ReconcileDialog,
  TransferDialog,
} from "../finance/AccountDialogs";
import { ScheduleDialog } from "../finance/ScheduleDialog";
import { SchedulePaymentDialog } from "../finance/SchedulePaymentDialog";
import {
  BudgetDialog,
  GoalDialog,
  ContribDialog,
} from "../finance/GoalDialogs";
import { ImportDialog } from "../finance/ImportDialog";
import { ConfirmDialog } from "./ConfirmDialog";
export const DIALOGS = {
  confirm: ConfirmDialog,
  habit: HabitDialog,
  habitDay: HabitDayDialog,
  habitPause: HabitPauseDialog,
  routine: RoutineDialog,
  txn: TxnDialog,
  transfer: TransferDialog,
  account: AccountDialog,
  reconcile: ReconcileDialog,
  budget: BudgetDialog,
  schedule: ScheduleDialog,
  schedulePayment: SchedulePaymentDialog,
  goal: GoalDialog,
  contrib: ContribDialog,
  import: ImportDialog,
};
export const SHEETS = {
  routineArchive: RoutineArchiveSheet,
  routineHistory: RoutineHistorySheet,
  streakRules: StreakRulesSheet,
};
export type DialogProps = {
  [K in keyof typeof DIALOGS]: ComponentProps<(typeof DIALOGS)[K]>;
};
export type SheetProps = {
  [K in keyof typeof SHEETS]: ComponentProps<(typeof SHEETS)[K]>;
};
