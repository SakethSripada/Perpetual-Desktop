import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Nav } from './components/Nav';
import { Story } from './components/Story';

export function App() {
  return (
    <div id="top" className="grain">
      <Nav />
      <main>
        <Hero />
        <Story />
      </main>
      <Footer />
    </div>
  );
}
