import {
  type ApplicationInformation,
  AppWrapperRoute,
  defineWebApplication,
  useUserStore,
} from '@opencloud-eu/web-pkg';
import {useGettext} from 'vue3-gettext';
import App from './App.vue';
import {userContext} from './userContext';

const appId = 'pdf-annotator';

export default defineWebApplication({
  setup() {
    const {$gettext} = useGettext();
    const routeName = 'pdf-annotator-file';

    try {
      // Written into each new/edited PDF annotation as /T (author).
      const {user} = useUserStore();
      const record = user as {
        displayName?: string;
        onPremisesSamAccountName?: string;
        userName?: string;
        id?: string;
      } | undefined;
      userContext.displayName = record?.displayName ?? '';
      userContext.userName = record?.onPremisesSamAccountName ?? record?.userName ?? '';
      userContext.id = record?.id ?? '';
    } catch {
      userContext.displayName = '';
      userContext.userName = '';
      userContext.id = '';
    }

    const routes = [
      {
        path: '/:driveAliasAndItem(.*)?',
        name: routeName,
        component: AppWrapperRoute(App, {
          applicationId: appId,
          fileContentOptions: {
            responseType: 'arraybuffer',
          },
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('PDF Annotator'),
          patchCleanPath: true,
        },
      },
    ];

    const appInfo: ApplicationInformation = {
      id: appId,
      name: $gettext('PDF Annotator'),
      icon: 'file-pdf',
      color: '#b3261e',
      defaultExtension: 'pdf',
      meta: {
        // Annotated PDFs are held in memory as a whole; warn for very large files.
        fileSizeLimit: 100_000_000,
      },
      extensions: [
        {
          extension: 'pdf',
          mimeType: 'application/pdf',
          routeName,
          label: () => $gettext('Mit PDF Annotator öffnen'),
          hasPriority: true,
        },
      ],
    };

    return {
      appInfo,
      routes,
    };
  },
});
