# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

# Micro-Frontend Architecture with Git Subtrees

Use Git subtrees to pull and maintain upstream changes from all three projects
Create a monorepo structure with clear separation of concerns
Implement a shared design system based on Material-UI

bedroq-dashboard/
├── packages/
│   ├── kicanvas-integration/     # KiCanvas as subtree
│   ├── chatbot-integration/      # Chatbot UI as subtree  
│   ├── material-dashboard/       # Your main dashboard
│   └── shared-ui/                # Shared components & theme
├── apps/
│   └── main-dashboard/          # Main application
└── tools/
    └── build-scripts/

# Integration of kicad-Canvas

### Add KiCanvas as subtree
git subtree add --prefix=frontend/bedroqui/packages/kicanvas-integration \
  https://github.com/theacodes/kicanvas.git main --squash


### Update KiCanvas as subtree
git subtree add --prefix=packages/kicanvas-integration \
  https://github.com/theacodes/kicanvas.git main --squash


###
If the main program cannot find the the kicanvas funcationality or individual elements you might need to run this manually

# Make sure KiCanvas is built and copied
cd vendor/kicanvas
npm run build
cp dist/kicanvas.js ../../public/

src/
├── types/
│   └── kicanvas.d.ts                    # TypeScript declarations
├── components/
│   └── kicanvas/
│       ├── KiCanvasBase.tsx             # Fixed base component
│       ├── KiCanvasViewer.tsx           # Enhanced viewer
│       ├── KiCanvasController.ts        # Controller class
│       ├── useKiCanvas.ts               # React hook
│       └── index.ts                     # Exports
public/
└── kicanvas.js                          # Built KiCanvas file


# If updates exist, rebuild
TODO: cd vendor/kicanvas && npm run build && cp dist/kicanvas.js ../../public/