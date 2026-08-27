import UIKit
import Capacitor

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Two different kinds of URL arrive here, and they must not be confused.
        //
        // 1. com.googleusercontent.apps.<id>://
        //    Google's own OAuth callback. GoogleSignIn (used by
        //    @capgo/capacitor-social-login) parks the sign-in continuation
        //    internally and only resumes it when the URL is handed to
        //    `GIDSignIn.handle`. Route it to Capacitor instead and the account
        //    sheet closes onto a screen that never changes — the sign-in is
        //    left waiting forever with no error to show. The URL scheme itself
        //    is registered in Info.plist by scripts/ios-post-sync.sh.
        //
        // 2. fleettrackmate://auth/callback
        //    Our own scheme, carrying the Supabase session back from a
        //    browser OAuth round trip, an email confirmation, or a password
        //    reset. That belongs to Capacitor's App plugin, which surfaces it
        //    to JS as `appUrlOpen` (see services/adminAuth.ts).
        //
        // `handle` returns false for anything it does not recognise, so the
        // fallthrough below stays correct for every other URL.
        #if canImport(GoogleSignIn)
        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }
        #endif

        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
