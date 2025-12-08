import { AppProvider } from '@/context/AppContext';
import { Hero, Filters, RecipeList, MobileDrawer, BackToTop } from '@/components';
import './App.css';

function AppContent() {
  return (
    <>
      <Hero />
      <MobileDrawer />
      <main className="layout">
        <Filters />
        <section className="content" aria-live="polite">
          <RecipeList />
        </section>
      </main>
      <BackToTop />
    </>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
