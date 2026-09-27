import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Nav } from './components/Nav';

export function App() {
  return (
    <div id="top" className="grain">
      <Nav />
      <main>
        <Hero />
      </main>
      <Footer />
    </div>
  );
}
