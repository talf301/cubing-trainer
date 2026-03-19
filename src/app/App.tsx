import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import { Timer, History, Training, Settings } from "./routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Timer />} />
          <Route path="/history" element={<History />} />
          <Route path="/training" element={<Training />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
