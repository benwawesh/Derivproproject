import React from 'react';
import { useHistory } from 'react-router-dom';
import './dpa-nav.scss';

const DPANav = () => {
    const history = useHistory();
    return (
        <div className='dpa-nav__logo' onClick={() => history.push('/')}>
            <div className='dpa-nav__logo-icon'>D</div>
            <div className='dpa-nav__logo-text'>
                <span className='dpa-nav__logo-name'>DerivPro</span>
                <span className='dpa-nav__logo-sub'>Academy</span>
            </div>
        </div>
    );
};

export default DPANav;
