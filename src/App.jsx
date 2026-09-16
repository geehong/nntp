import React, { useEffect } from 'react';
import { useNNTPStore } from './store/useNNTPStore';
import TopHeader from './components/layout/TopHeader';
import NewsgroupSidebar from './components/sidebar/NewsgroupSidebar';
import ArticleTable from './components/reader/ArticleTable';
import FarmDashboard from './components/dashboard/FarmDashboard';
import CredentialsForm from './components/credentials/CredentialsForm';
import RecommendedUsenet from './components/recommendations/RecommendedUsenet';
import ServerModal from './components/credentials/ServerModal';

export default function App() {
  const { activeTab, connectBridge, fetchFavorites, fetchServerNewsgroupsPage } = useNNTPStore();

  useEffect(() => {
    connectBridge();
    fetchFavorites();
    fetchServerNewsgroupsPage({ page: 1 });
  }, []);

  return (
    <div className="app-container">
      <TopHeader />

      <div className="main-layout">
        {activeTab === 'reader' && <NewsgroupSidebar />}

        <main className="main-content">
          {activeTab === 'reader' && <ArticleTable />}
          {activeTab === 'farm' && <FarmDashboard />}
          {activeTab === 'recommended' && <RecommendedUsenet />}
          {activeTab === 'credentials' && <CredentialsForm />}
        </main>
      </div>

      <ServerModal />
    </div>
  );
}
