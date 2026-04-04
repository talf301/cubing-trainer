import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import { Timer, History, Training, TrainingCross, PllTrainerRoute, PllSpamRoute, PllSpamStatsRoute, F2LSolutionRoute, F2LSolutionStatsRoute, Settings, Debug } from "./routes";
import { useWakeLock } from "./useWakeLock";

export default function App() {
  useWakeLock();

  return (
    <BrowserRouter basename="/cubing-trainer">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Timer />} />
          <Route path="/history" element={<History />} />
          <Route path="/training" element={<Training />} />
          <Route path="/training/cross" element={<TrainingCross />} />
          <Route path="/training/pll" element={<PllTrainerRoute />} />
          <Route path="/training/f2l" element={<F2LSolutionRoute />} />
          <Route path="/training/f2l/stats" element={<F2LSolutionStatsRoute />} />
          <Route path="/pll-spam" element={<PllSpamRoute />} />
          <Route path="/pll-spam/stats" element={<PllSpamStatsRoute />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/debug" element={<Debug />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
