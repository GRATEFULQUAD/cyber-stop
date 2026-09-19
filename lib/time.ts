export function formatTime(ms: number): { main: string; centis: string } {
  const totalCentis = Math.floor(ms / 10);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");

  const main = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;

  return { main, centis: pad(centis) };
}

export interface TimeParts {
  hrs: string;
  min: string;
  sec: string;
  ms: string;
}

export function getTimeParts(elapsedMs: number): TimeParts {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const totalCentis = Math.floor(elapsedMs / 10);
  const cs = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const sec = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const min = totalMinutes % 60;
  const hrs = Math.floor(totalMinutes / 60) % 100;
  return { hrs: pad(hrs), min: pad(min), sec: pad(sec), ms: pad(cs) };
}
