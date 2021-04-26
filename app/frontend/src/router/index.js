import NProgress from 'nprogress';
import Vue from 'vue';
import VueRouter from 'vue-router';

Vue.use(VueRouter);

let isFirstTransition = true;

/**
 * Constructs and returns a Vue Router object
 * @param {string} [basePath='/'] the base server path
 * @returns {object} a Vue Router object
 */
export default function getRouter(basePath = '/') {
  const router = new VueRouter({
    base: basePath,
    mode: 'history',
    routes: [
      {
        path: '/',
        redirect: { name: 'Home' }
      },
      {
        path: '/',
        name: 'Home',
        component: () => import(/* webpackChunkName: "home" */ '@/views/Home.vue'),
        meta: {
          hasLogin: true
        }
      },
      {
        path: '/email',
        name: 'Email',
        component: () => import(/* webpackChunkName: "email" */ '@/views/Email.vue'),
        redirect: 'email/send', // redirect to first sub-tab
        children: [
          {
            path: 'send',
            name: 'EmailSend',
            component: () => import(/* webpackChunkName: "emailsend" */ '@/views/email/EmailSend.vue')
          },
          {
            path: 'history',
            name: 'EmailHistory',
            component: () => import(/* webpackChunkName: "emailhistory" */ '@/views/email/EmailHistory.vue')
          }
        ],
        meta: {
          hasLogin: true,
          requiresAuth: true
        }
      },
      {
        path: '/merge',
        name: 'Merge',
        component: () => import(/* webpackChunkName: "email" */ '@/views/Merge.vue'),
        redirect: 'merge/send', // redirect to first sub-tab
        children: [
          {
            path: 'send',
            name: 'MergeSend',
            component: () => import(/* webpackChunkName: "mergesend" */ '@/views/merge/MergeSend.vue')
          },
          {
            path: 'history',
            name: 'MergeHistory',
            component: () => import(/* webpackChunkName: "mergehistory" */ '@/views/merge/MergeHistory.vue')
          },
          {
            path: 'help',
            name: 'MergeHelp',
            component: () => import(/* webpackChunkName: "mergehelp" */ '@/views/merge/MergeHelp.vue')
          }
        ],
        meta: {
          hasLogin: true,
          requiresAuth: true
        }
      },
      {
        path: '/404',
        alias: '*',
        name: 'NotFound',
        component: () => import(/* webpackChunkName: "not-found" */ '@/views/NotFound.vue'),
        meta: {
          hasLogin: true
        }
      }
    ]
  });

  router.beforeEach((to, _from, next) => {
    NProgress.start();
    if (to.matched.some(route => route.meta.requiresAuth)
      && router.app.$keycloak
      && router.app.$keycloak.ready
      && !router.app.$keycloak.authenticated) {
      const redirect = location.origin + basePath + to.path + location.search;
      const loginUrl = router.app.$keycloak.createLoginUrl({
        idpHint: 'idir',
        redirectUri: redirect
      });
      window.location.replace(loginUrl);
    } else {
      document.title = to.meta.title ? to.meta.title : process.env.VUE_APP_TITLE;
      if (to.query.r && isFirstTransition) {
        router.replace({
          path: to.query.r.replace(basePath, ''),
          query: (({ r, ...q }) => q)(to.query) // eslint-disable-line no-unused-vars
        });
      }
      next();
    }
  });

  router.afterEach(() => {
    isFirstTransition = false;
    NProgress.done();
  });

  return router;
}
