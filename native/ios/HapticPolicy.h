/* UIKit public enum values, available on the app's minimum iOS 16. */
#ifndef LIST_HAPTIC_POLICY_H
#define LIST_HAPTIC_POLICY_H
typedef struct { int notification; long style; double intensity; } ListHaptic;
static int ListEqual(const char *a, const char *b) {
    if (!a || !b) return 0;
    while (*a && *a == *b) { ++a; ++b; }
    return *a == *b;
}
static int ListHapticForKind(const char *kind, ListHaptic *out) {
    if (!out) return 0;
    if (ListEqual(kind,"damage")) *out=(ListHaptic){0,1,.6};
    else if (ListEqual(kind,"heal")) *out=(ListHaptic){0,4,.35};
    else if (ListEqual(kind,"roll")) *out=(ListHaptic){0,0,.3};
    else if (ListEqual(kind,"critical-success")) *out=(ListHaptic){1,0,0};
    else if (ListEqual(kind,"critical-failure")) *out=(ListHaptic){1,1,0};
    else if (ListEqual(kind,"invalid")) *out=(ListHaptic){0,3,.3};
    else return 0;
    return 1;
}
static int ListHapticAllowed(int mainFrame, int active, int visible,
                            double now, double previous) {
    if (!mainFrame || !active || !visible || !(now >= 0 && now < 1e12)) return 0;
    /* Reset the small debounce window if the wall clock moves backwards. */
    return previous < 0 || now < previous || now-previous >= .12;
}
#endif
