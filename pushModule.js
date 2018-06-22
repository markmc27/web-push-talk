window.APP = (function (module, $, VAPID_PUBLIC_KEY) {
    "use strict";

    var m = module;
    m.pushModule = {};

    var applicationServerPublicKey = VAPID_PUBLIC_KEY;
    var $toggleButton = $('.js-toggle-push');

    function _urlB64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - base64String.length % 4) % 4);
        var base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        var rawData = window.atob(base64);
        var outputArray = new Uint8Array(rawData.length);

        for (var i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    function _base64Encode(arrayBuffer) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(arrayBuffer)));
    };

    function _initialiseServiceWorker() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.register('/sw.js')
                .catch(function (error) {
                    console.error('Service Worker Error', error);
                });
        } else {
            $('.js-push-section').remove(); //user can't subscribe more than once
        }
    };

    function _requestNotificationPermission() {
        return new Promise(function (resolve, reject) {
            Notification.requestPermission().then(function (status) {
                if (status === 'denied') {
                    reject();
                } else if (status === 'granted') {
                    resolve();
                }
            });
        });
    };

    function _subscribeToPush() {
        var registration = null;
        return navigator.serviceWorker.ready
            .then(function (reg) {
                registration = reg;
                return _requestNotificationPermission();
            })
            .then(function () {
                var subscribeParams = { userVisibleOnly: true };
                var applicationServerKey = _urlB64ToUint8Array(applicationServerPublicKey);
                subscribeParams.applicationServerKey = applicationServerKey;

                return registration.pushManager.subscribe(subscribeParams);
            })
            .then(function (subscription) {
                var p256dh = _base64Encode(subscription.getKey('p256dh'));
                var auth = _base64Encode(subscription.getKey('auth'));

                $.post('/umbraco/api/push/add', {
                    PushEndpoint: subscription.endpoint,
                    PushP256DH: p256dh,
                    PushAuth: auth,
                    Token: $('#pushToken').val() //csrf token 
                })
                .done(function () {
                    $toggleButton.text('Enabled!');
                });
            })
            .catch(function (e) {
                console.log('Unable to subscribe to push', e);
            });;
    };

    var setupServiceWorker = function () {
        _initialiseServiceWorker();
        navigator.serviceWorker.ready.then(function (reg) {
            reg.pushManager.getSubscription()
                .then(function (subscription) {
                    if (!subscription) { 
                        //subscription wasn't successful for some reason 
                    } else {
                        $('.js-push-section').remove();
                    }
                })
                .catch(function (err) {
                    console.log('Unable to get subscription details.', err);
                });
        });
    };

    var setupPushButton = function () {
        //inititate push subscription on button click
        $toggleButton.on('click', function () {
            _subscribeToPush()
                .then(function () {
                    $toggleButton.prop('disabled', true);
                });
        });
    }

    // modules to fire on pageload
    m.pushModule.init = function () {
        setupServiceWorker();
        setupPushButton();
    };

    return module;

})(window.APP || {}, window.jQuery, window.APP.VAPID_PUBLIC_KEY);