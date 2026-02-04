import { createRef, useEffect } from "react";
import { createRoot } from "react-dom/client";

import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  useOutlet,
  useNavigate,
  redirect,
} from "react-router-dom";

import { CSSTransition, SwitchTransition } from "react-transition-group";
import { actionScroll } from "./redux/actions/utils/utils";
import Home from "./containers/pages/home";
import NotFound from "./containers/errors/error404";
import RetinaAnalysisProgress from "./containers/pages/RetinaAnalysisProgress";
import Monitor from "./containers/pages/monitor";
import Quant from "./containers/pages/quant";
import QuantEval from "./containers/pages/QuantizedModelEvaluation";
import Detections from "./containers/pages/detections";
import "./assets/css/bootstrap.css";
import "./assets/css/administrador.css";
import "./styles.css";

import store from "./store";
import { Provider, useDispatch } from "react-redux";
import ElectronView from "./electron_view";

const routes = [
  
 

  {
    path: "/home",
    value: "0-0",
    name: "Home",
    element: <Home />,
    nodeRef: createRef(),
    className: "Home",
  },
  {
  path: "/retina/progress",
  value: "retina-progress",
  name: "RetinaProgress",
  element: <RetinaAnalysisProgress />,
  nodeRef: createRef(),
  className: "RetinaProgress",
},
{
  path: "/quant",
  value: "retina-quant",
  name: "RetinaQuant",
  element: <Quant />,
  nodeRef: createRef(),
  className: "RetinaQuant",
},
{
  path: "/monitor",
  value: "retina-monitor",
  name: "RetinaMonitor",
  element: <Monitor />,
  nodeRef: createRef(),
  className: "RetinaMonitor",
},,
{
  path: "/quant-eval",
  value: "retina-quant-eval",
  name: "RetinaQuantEval",
  element: <QuantEval />,
  nodeRef: createRef(),
  className: "RetinaQuantEval",
},
{
  path: "/detections",
  value: "retina-detections",
  name: "RetinaDetections",
  element: <Detections />,
  nodeRef: createRef(),
  className: "RetinaDetections",
},
  {
    path: "*",
    value: "NotFound",
    name: "NotFound",
    element: <NotFound />,
    nodeRef: createRef(),
    className: "NotFound",
  },
];


const router = createBrowserRouter([
  {
    path: "/",
    element: <Example />,
    children: routes.map((route) => ({
      index: route.path === "/",
      path: route.path === "/" ? undefined : route.path,
      element: route.element,
    })),
  },
]);

function Example() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const currentOutlet = useOutlet();

  const pathname = location.pathname;
  const normalpath = pathname.replace(/\/+$/, "");

  // =========================
  // Resolver routecorrect (soporta :tipo, :idExpediente, etc.)
  // =========================
  let routecorrect = routes.find((route) => {
    if (!route?.path) return false;

    if (route.path === "*") return normalpath !== "/";
    if (route.path === normalpath) return true;

    const routeParts = route.path.split("/").filter(Boolean);
    const pathParts = normalpath.split("/").filter(Boolean);

    if (routeParts.length !== pathParts.length) return false;

    for (let i = 0; i < routeParts.length; i++) {
      const rp = routeParts[i];
      const pp = pathParts[i];
      if (rp.startsWith(":")) continue;
      if (rp !== pp) return false;
    }
    return true;
  });

  const { nodeRef } = routecorrect || {};

  // =========================
  // Ocultar popover en rutas específicas
  // =========================
  const hideUserPopover = ["/login", "/prelogin", "/signup"].includes(normalpath);


  const handleRightClick = (event) => {
    if (event.target.classList.contains("cardcatalogo")) {
      event.preventDefault();
    }
  };

  const onScroll = (event) => {
    dispatch(actionScroll(event.currentTarget.scrollTop));
  };


  return (
    <>
  <ElectronView
      
        hideUserPopover={hideUserPopover}
      />
      <div className="content-electron "  style={{
    height: `calc(100vh - 36px)`,
  }}>
        <div
 
>
  
</div>

        <div onScroll={onScroll} onContextMenu={handleRightClick}>
          <div>
            <SwitchTransition>
              <CSSTransition
                key={location.pathname}
                nodeRef={nodeRef}
                timeout={200}
                classNames="page"
                unmountOnExit
              >
                {(state) => (
                  <div ref={nodeRef} className="page">
                    {currentOutlet}
                  </div>
                )}
              </CSSTransition>
            </SwitchTransition>
          </div>
        </div>
      </div>
    </>
  );
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <Provider store={store}>
    <RouterProvider router={router} />
  </Provider>
);
