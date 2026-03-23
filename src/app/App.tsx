import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import { Timer, History, Training, TrainingCross, Settings, Debug } from "./routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Timer />} />
          <Route path="/history" element={<History />} />
          <Route path="/training" element={<Training />} />
          <Route path="/training/cross" element={<TrainingCross />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/debug" element={<Debug />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
