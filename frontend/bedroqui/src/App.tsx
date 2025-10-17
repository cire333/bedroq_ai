
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { UsersContainer } from './dashboard/containers/UsersContainer';
import { DevicesContainer } from './dashboard/containers/DevicesContainer';
import { ProjectsContainer } from './dashboard/containers/ProjectsContainer';
import { ProjectContainer } from './dashboard/containers/ProjectContainer';
import ProjectSetupContainer from './dashboard/containers/ProjectSetupContainer';
import { FirmwareContainer } from './dashboard/containers/FirmwaresContainer';
import { ReviewContainer } from './dashboard/containers/ReviewContainer';

import * as React from 'react';
import type {} from '@mui/x-date-pickers/themeAugmentation';
import type {} from '@mui/x-charts/themeAugmentation';
import type {} from '@mui/x-data-grid-pro/themeAugmentation';
import type {} from '@mui/x-tree-view/themeAugmentation';

import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import AppNavbar from './dashboard/components/AppNavbar';
import Header from './dashboard/components/Header';
import MainGrid from './dashboard/components/MainGrid';
import SideMenu from './dashboard/components/SideMenu';
import AppTheme from './shared-theme/AppTheme';

import {
  chartsCustomizations,
  dataGridCustomizations,
  datePickersCustomizations,
  treeViewCustomizations,
} from './dashboard/theme/customizations';

import { login, logout, getIdToken } from "./auth";

const xThemeComponents = {
  ...chartsCustomizations,
  ...dataGridCustomizations,
  ...datePickersCustomizations,
  ...treeViewCustomizations,
};

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Home page content (original dashboard) Goes away in the future
const HomePage: React.FC = () => {
  return (
    <Stack
      spacing={2}
      sx={{
        alignItems: 'center',
        mx: 3,
        pb: 5,
        mt: { xs: 8, md: 0 },
      }}
    >
      <Header />
      <MainGrid />
    </Stack>
  );
};

// function App(props: { disableCustomTheme?: boolean }) {
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <SideMenu />
      <AppNavbar />
      {/* Main content */}
      <Box
        component="main"
        sx={(theme) => ({
          flexGrow: 1,
          backgroundColor: theme.palette.mode === 'light' ? theme.palette.grey[100] : theme.palette.background.default,
            // ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
            // : alpha(theme.palette.background.default, 1),
          overflow: 'auto',
        })}
      >
        <Stack
          spacing={2}
          sx={{
            alignItems: 'center',
            mx: 3,
            pb: 5,
            mt: { xs: 8, md: 0 },
          }}
        >
          {children}
        </Stack>
      </Box>
    </Box>
  );
}

interface AppProps {
  disableCustomTheme?: boolean;
  [key: string]: any;
}

export default function App(props: AppProps): React.ReactElement {
  return (
    <AppTheme {...props} themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
      <Router>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsContainer />} />
            <Route path="/reviews" element={<ReviewContainer />} />
            <Route path="/users" element={<UsersContainer />} />
            <Route path="/devices" element={<DevicesContainer />} />
            <Route path="/firmwares" element={<FirmwareContainer />} />
            <Route path="/users/:id" element={<UsersContainer />} />
            <Route path="/projects/:id" element={<ProjectContainer />} />
            <Route path="/project-setup" element={<ProjectSetupContainer />} />
            {/* Placeholder routes for other menu items */}
            <Route path="/analytics" element={<Box sx={{ p: 3 }}><h1>Analytics Page</h1><p>This page is under construction.</p></Box>} />
            <Route path="/feedback" element={<Box sx={{ p: 3 }}><h1>Feedback Page</h1><p>This page is under construction.</p></Box>} />
            <Route path="/about" element={<Box sx={{ p: 3 }}><h1>About Page</h1><p>This page is under construction.</p></Box>} />
            <Route path="/integrations" element={<Box sx={{ p: 3 }}><h1>Integrations Page</h1><p>This page is under construction.</p></Box>} />
            <Route path="/settings" element={<Box sx={{ p: 3 }}><h1>Settings Page</h1><p>This page is under construction.</p></Box>} />
            {/* Redirect any unknown routes to home */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </DashboardLayout>
      </Router>
    </AppTheme>
  );
}



// App.js needs to be added for login/authentication

// import { useAuth } from "react-oidc-context";

// function App() {
//   const auth = useAuth();

//   const signOutRedirect = () => {
//     const clientId = "3ahaoavqt9lf07j2btnv26d5dr";
//     const logoutUri = "<logout uri>";
//     const cognitoDomain = "https://<user pool domain>";
//     window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
//   };

//   if (auth.isLoading) {
//     return <div>Loading...</div>;
//   }

//   if (auth.error) {
//     return <div>Encountering error... {auth.error.message}</div>;
//   }

//   if (auth.isAuthenticated) {
//     return (
//       <div>
//         <pre> Hello: {auth.user?.profile.email} </pre>
//         <pre> ID Token: {auth.user?.id_token} </pre>
//         <pre> Access Token: {auth.user?.access_token} </pre>
//         <pre> Refresh Token: {auth.user?.refresh_token} </pre>

//         <button onClick={() => auth.removeUser()}>Sign out</button>
//       </div>
//     );
//   }

//   return (
//     <div>
//       <button onClick={() => auth.signinRedirect()}>Sign in</button>
//       <button onClick={() => signOutRedirect()}>Sign out</button>
//     </div>
//   );
// }

// export default App;