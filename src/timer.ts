import { Message } from './VsCodeUtils';
import { Data } from './Data';

export class Timer { // TODO replace the strings with constants

    private static startTime?: number;
    private static accumulatedTime: number = 0;
    private static isTimerPaused: boolean = false;
    private static startDateIsoFormat?: string;

    public static async startTimer() {
        const startTime = Date.now();
        const accumulatedTime = 0;
        const isTimerPaused = false;

        const startDate = new Date(startTime);
        const startDateIsoFormat = this.formatDateToCustomISO(startDate);

        this.startTime = startTime;
        this.accumulatedTime = accumulatedTime;
        this.isTimerPaused = isTimerPaused;
        this.startDateIsoFormat = startDateIsoFormat;

        return;
    }

    public static pauseResumeTimer(): void {
        const startTime = this.startTime;
        const isTimerPaused = this.isTimerPaused;
        if (!startTime) return;
        if (!isTimerPaused) {
            this.pauseTimer(startTime);
        } else if (isTimerPaused) {
            this.resumeTimer();
        }
    }

    private static resumeTimer() {
        this.startTime = Date.now();
        this.isTimerPaused = false;

        Message.info(Data.MESSAGES.INFO.TIMER_RESUMED);
    }

    private static pauseTimer(startTime: number) {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const accumulatedTime = this.accumulatedTime + elapsed;

        this.startTime = undefined;
        this.accumulatedTime = accumulatedTime;
        this.isTimerPaused = true;

        Message.info(Data.MESSAGES.INFO.TIMER_PAUSED);
    }

    public static stopTimer() {
        const startTime = this.startTime;
        let totalDurationMs = this.accumulatedTime;

        const endTime = Date.now();

        if (!startTime) throw new Error("No timer running");
        totalDurationMs += endTime - startTime;

        const durationMinutes = Math.round(totalDurationMs / 1000 / 60);

        // const durationSeconds = (totalDurationMs / 1000).toFixed(2);
        Message.info(Data.MESSAGES.INFO.TIMER_STOPPED(durationMinutes));

        this.startTime = undefined;
        this.accumulatedTime = 0;

        return durationMinutes;
    }

    private static formatDateToCustomISO(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}${month}${day} T ${hours}${minutes}${seconds}`;

    }

    public static async giveStartTime() {
        const startDateIsoFormat = this.startDateIsoFormat;
        if(!startDateIsoFormat) throw new Error("timer failed to start");
        return startDateIsoFormat;
    }

    public static isTaskRunnig(): boolean {
        if (this.startTime) return true;
        return false;
    }

}