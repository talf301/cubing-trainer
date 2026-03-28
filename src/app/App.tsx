import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import { Timer, History, Training, TrainingCross, PllTrainerRoute, Settings, Debug } from "./routes";

export default function App() {
  return (
    <BrowserRouter basename="/cubing-trainer">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Timer />} />
          <Route path="/history" element={<History />} />
          <Route path="/training" element={<Training />} />
          <Route path="/training/cross" element={<TrainingCross />} />
          <Route path="/training/pll" element={<PllTrainerRoute />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/debug" element={<Debug />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
