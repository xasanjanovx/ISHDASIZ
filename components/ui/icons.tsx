/**
 * Icons wrapper - uses Flaticon Uicons (@iconscout/react-unicons)
 * This provides a single import point for all icons across the project
 */
import React from 'react';
export type LucideIcon = React.FC<any>;
export type LucideProps = React.SVGProps<SVGSVGElement> & { size?: string | number; color?: string };

import {
    UilUser,
    UilPhone,
    UilEnvelope,
    UilMapMarker,
    UilBuilding,
    UilBriefcase,
    UilFileAlt,
    UilSearch,
    UilCheck,
    UilTimes,
    UilPlus,
    UilMinus,
    UilEdit,
    UilTrashAlt,
    UilEye,
    UilEyeSlash,
    UilArrowLeft,
    UilArrowRight,
    UilArrowUp,
    UilArrowDown,
    UilAngleLeft,
    UilAngleRight,
    UilAngleUp,
    UilAngleDown,
    UilHome,
    UilSetting,
    UilSignOutAlt,
    UilSignInAlt,
    UilCog,
    UilBell,
    UilCommentAlt,
    UilComment,
    UilCalendarAlt,
    UilClock,
    UilStar,
    UilHeart,
    UilShareAlt,
    UilBookmark,
    UilFilter,
    UilSync,
    UilImport,
    UilExport,
    UilLinkAlt,
    UilCopy,
    UilCamera,
    UilImageV,
    UilPlay,
    UilPause,
    UilLock,
    UilUnlock,
    UilShieldCheck,
    UilCheckCircle,
    // UilPlusCircle - does not exist, using UilPlus as fallback
    UilTimesCircle,
    UilInfoCircle,
    UilExclamationTriangle,
    UilSpinner,
    UilEllipsisV,
    UilEllipsisH,
    UilBars,
    UilApps,
    UilListUl,
    UilChartLine,
    UilChartBar,
    UilMoneyBill,
    UilUsersAlt,
    UilUserPlus,
    UilFingerprint,
    UilKeySkeleton,
    UilSave,
    UilFileAlt as UilFile,
    UilClipboardAlt,
    UilGlobe,
    UilRocket,
    UilGraduationCap,
    UilPen,
    UilMessage,
    UilPrint,
    UilExternalLinkAlt,
    UilDownloadAlt,
    UilTag,
    UilLanguage,
    UilQrcodeScan,
    UilMonitor,
    UilDesktop,
    UilShoppingBag,
    UilTruck,
    UilWallet,
    UilPlane,
    UilWrench,
    UilPalette,
    UilUtensils,
    UilLaptop,
    UilStethoscope,
    UilFlower,
    UilTrees,
    UilSort,
    UilHistory,
    UilUniversity,
    UilNavigator,
    UilAccessibleIconAlt,
    UilUserSquare,
    UilCircle,
    UilDraggabledots,
} from '@iconscout/react-unicons';

import { Bot as LucideBot, Sparkles as LucideSparkles, Wand2 as LucideWand2 } from 'lucide-react';

// Re-export with lucide-react compatible names
// User & People
export const User = UilUser;
export const Users = UilUsersAlt;
export const UserPlus = UilUserPlus;
export const UserSquare2 = UilUserSquare;

// Communication
export const Phone = UilPhone;
export const Mail = UilEnvelope;
export const MessageSquare = UilCommentAlt;
export const MessageCircle = UilComment;
export const Bell = UilBell;

// Location
export const MapPin = UilMapMarker;
export const MapIcon = UilMapMarker;
export const Globe = UilGlobe;
export const Landmark = UilUniversity;
export const Navigation = UilNavigator;

// Business & Work
export const Building2 = UilBuilding;
export const Briefcase = UilBriefcase;
export const Factory = UilBuilding; // Fallback
export const ShoppingBag = UilShoppingBag;
export const Truck = UilTruck;
export const Wallet = UilWallet;

// Files & Documents
export const FileText = UilFileAlt;
export const File = UilFile;
export const FilePlus = UilFileAlt;
export const Clipboard = UilClipboardAlt;

// Actions
export const Search = UilSearch;
export const Check = UilCheck;
export const X = UilTimes;
export const Plus = UilPlus;
export const PlusCircle = UilPlus; // Fallback - UilPlusCircle doesn't exist
export const Minus = UilMinus;
export const Edit = UilEdit;
export const Edit3 = UilEdit;
export const Pencil = UilPen;
export const Trash2 = UilTrashAlt;
export const Save = UilSave;
export const Download = UilDownloadAlt;
export const Upload = UilExport;
export const Copy = UilCopy;
export const Share = UilShareAlt;
export const Link = UilLinkAlt;
export const ExternalLink = UilExternalLinkAlt;
export const RefreshCw = UilSync;
export const RotateCcw = UilSync;
export const Send = UilMessage;
export const Print = UilPrint;

// View
export const Eye = UilEye;
export const EyeOff = UilEyeSlash;
export const Filter = UilFilter;
export const Grid = UilApps;
export const Grid3X3 = UilApps;
export const List = UilListUl;
export const Menu = UilBars;
export const ArrowUpDown = UilSort;

// Arrows
export const ArrowLeft = UilArrowLeft;
export const ArrowRight = UilArrowRight;
export const ArrowUp = UilArrowUp;
export const ArrowDown = UilArrowDown;
export const ChevronLeft = UilAngleLeft;
export const ChevronRight = UilAngleRight;
export const ChevronUp = UilAngleUp;
export const ChevronDown = UilAngleDown;

// Navigation
export const Home = UilHome;
export const Settings = UilSetting;
export const Cog = UilCog;
export const LogOut = UilSignOutAlt;
export const LogIn = UilSignInAlt;

// Time & Calendar
export const Calendar = UilCalendarAlt;
export const CalendarDays = UilCalendarAlt;
export const Clock = UilClock;
export const History = UilHistory;

// Status & Alerts
export const CheckCircle = UilCheckCircle;
export const CheckCircle2 = UilCheckCircle;
export const BadgeCheck = UilCheckCircle;
export const XCircle = UilTimesCircle;
export const Info = UilInfoCircle;
export const AlertTriangle = UilExclamationTriangle;
export const AlertCircle = UilExclamationTriangle;
export const Accessibility = UilAccessibleIconAlt;
export const Circle = UilCircle;
export const Dot = UilCircle;

// Security
export const Shield = UilShieldCheck;
export const ShieldCheck = UilShieldCheck;
export const Lock = UilLock;
export const Unlock = UilUnlock;
export const Fingerprint = UilKeySkeleton; // Fallback
export const Key = UilKeySkeleton;
export const ScanFace = UilQrcodeScan; // Fallback

// UI Elements
export const Loader2 = UilSpinner;
export const MoreVertical = UilEllipsisV;
export const MoreHorizontal = UilEllipsisH;
export const GripVertical = UilDraggabledots;
export const Camera = UilCamera;
export const Image = UilImageV;
export const Tag = UilTag;
export const Languages = UilLanguage;

// Media
export const Play = UilPlay;
export const Pause = UilPause;

// Social & Engagement
export const Star = UilStar;
export const Heart = UilHeart;
export const Bookmark = UilBookmark;

// Money & Finance
export const Banknote = UilMoneyBill;
export const DollarSign = UilMoneyBill;

// Charts & Analytics
export const TrendingUp = UilChartLine;
export const BarChart3 = UilChartBar;
export const LineChart = UilChartLine;
export const BarChart = UilChartBar;

// Education
export const GraduationCap = UilGraduationCap;

// Tech
export const Monitor = UilMonitor;
export const Desktop = UilDesktop;
export const Laptop = UilLaptop;

// Categories
export const Wrench = UilWrench;
export const Palette = UilPalette;
export const Utensils = UilUtensils;
export const Stethoscope = UilStethoscope;
export const Plane = UilPlane;
export const Wheat = UilFlower; // Agriculture fallback
export const Leaf = UilFlower; // Fallback
export const Trees = UilTrees;

// Special
export const Sparkles = UilRocket;
export const Bot = UilRocket;
export const Rocket = UilRocket;
export const Wand2 = UilPen; // AI magic wand
export const Locate = UilNavigator; // GPS location
