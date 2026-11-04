import { SafeAreaView as NativeSafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

const SafeAreaView = withUniwind(NativeSafeAreaView);

export { SafeAreaView };
