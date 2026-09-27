import { Download } from './components/Download';
import { Features } from './components/Features';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Nav } from './components/Nav';
import { Story } from './components/Story';
import { Switch } from './components/Switch';

export function App() {
  return (
    <div id="top">
      <Nav />
      <main>
        <Hero />
        <Story />
        <Switch />
        <Features />
        <Download />
      </main>
      <Footer />
    </div>
  );
}
